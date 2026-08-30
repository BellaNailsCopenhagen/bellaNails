import type { Db } from "@/db/client"
import { getBookingSettings } from "@/db/booking-settings"
import { listActiveBookingSpansBetween } from "@/db/bookings"
import { getBookableService } from "@/db/services"
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/platform/supabase/server"
import {
  generateSlots,
  OVERRIDE_WINDOW,
  type BusySpan,
  type Slot,
} from "@/shared/booking-slots"
import { FEATURE_FLAGS } from "@/shared/feature-flags"
import type { Schedule } from "@/shared/schedule"
import { studioDayNumber } from "@/shared/studio-time"
import { getSchedule, isFeatureEnabled } from "@/modules/studio"

const DAY_MS = 86_400_000
const MIN = 60_000
const DEFAULT_MAX_ADVANCE_DAYS = 60

// Override bypasses HOURS, not the booking window — the horizon stays the normal
// booking horizon. OVERRIDE_WINDOW (the daily envelope) lives in shared/ so the
// picker labels can quote the same bounds.

/**
 * How many days ahead booking is open (the `booking_settings` horizon) — for
 * the picker's "book up to N days" note. Degrades to the default if settings
 * can't be read, so the note never blocks the page.
 */
export async function getMaxAdvanceDays(
  db: Db = createSupabaseServerClient(),
): Promise<number> {
  const settings = await getBookingSettings(db).catch(() => null)
  return settings?.max_advance_days ?? DEFAULT_MAX_ADVANCE_DAYS
}

/**
 * Free start times for a service (+ selected add-ons) — the client booking
 * flow's source of truth. Public-read (anon client); composes the global rules,
 * the service's total duration, the studio schedule, and existing bookings, then
 * runs the pure slot generator. Degrades to [] (missing config, or a transient
 * read error) so the UI shows "no times" rather than crashing.
 */
export async function getAvailableSlots(
  serviceId: string,
  addonIds: string[],
  db: Db = createSupabaseServerClient(),
  // Owner reschedule places bookings free of the public 24 h lead time.
  opts?: { ignoreLeadTime?: boolean },
): Promise<Slot[]> {
  return computeSlots(serviceId, addonIds, db, {
    ignoreLeadTime: opts?.ignoreLeadTime,
  })
}

/**
 * Both booking calendars for the /book confirm step in ONE pass — the shared
 * inputs (settings, service, schedule, busy scan) are fetched once and fed to
 * two generators, instead of running the whole pipeline twice.
 */
export async function getBookingSlots(
  serviceId: string,
  addonIds: string[],
  db: Db = createSupabaseServerClient(),
): Promise<{ normal: Slot[]; outside: Slot[]; outsideEnabled: boolean }> {
  try {
    const inputs = await loadSlotInputs(serviceId, addonIds, db)
    if (!inputs) return { normal: [], outside: [], outsideEnabled: false }
    // The flag drives the UI affordance (independent of whether slots exist now).
    const outsideEnabled = inputs.outsideEnabled
    return {
      normal: generateFor(inputs, {}),
      outside: outsideEnabled ? generateFor(inputs, { outsideHours: true }) : [],
      outsideEnabled,
    }
  } catch (error) {
    logSlotError(error)
    return { normal: [], outside: [], outsideEnabled: false }
  }
}

/**
 * ADMIN OVERRIDE free times — every day within the override envelope, with the
 * studio hours / no-work / lead time ignored, but still MINUS existing bookings
 * so the artist can only pick a genuinely free slot. Owner-gate at the caller.
 */
export async function getOverrideSlots(
  serviceId: string,
  addonIds: string[],
  db: Db,
): Promise<Slot[]> {
  return computeSlots(serviceId, addonIds, db, { override: true })
}

type SlotOpts = {
  ignoreLeadTime?: boolean
  outsideHours?: boolean
  override?: boolean
}

async function computeSlots(
  serviceId: string,
  addonIds: string[],
  db: Db,
  opts: SlotOpts,
): Promise<Slot[]> {
  try {
    const inputs = await loadSlotInputs(serviceId, addonIds, db)
    if (!inputs) return []
    // Outside-hours requests only exist when the artist has enabled them.
    if (opts.outsideHours && !inputs.outsideEnabled) return []
    return generateFor(inputs, opts)
  } catch (error) {
    logSlotError(error)
    return []
  }
}

type SlotInputs = {
  settings: NonNullable<Awaited<ReturnType<typeof getBookingSettings>>>
  schedule: Schedule
  outsideEnabled: boolean
  durationMins: number
  now: number
  maxAdvance: number
  busy: BusySpan[]
}

// Fetch everything the pure generator needs, once — shared by all slot modes.
async function loadSlotInputs(
  serviceId: string,
  addonIds: string[],
  db: Db,
): Promise<SlotInputs | null> {
  const [settings, service, schedule, outsideEnabled] = await Promise.all([
    getBookingSettings(db),
    getBookableService(db, serviceId),
    // Both self-degrade (empty schedule / flag off), so a missing migration shows
    // "no times" rather than crashing the booking flow.
    getSchedule(db),
    isFeatureEnabled(FEATURE_FLAGS.outsideHoursRequests, db),
  ])
  if (!settings || !service) return null

  // Total duration = base + the selected add-ons that actually belong to this
  // service and aren't archived (ignore stale/foreign ids from the client).
  const selected = new Set(addonIds)
  const addonDuration = service.service_addons.reduce((sum, { addons }) => {
    if (!addons || addons.archived_at || !selected.has(addons.id)) return sum
    return sum + addons.extra_duration_mins
  }, 0)
  const durationMins = service.base_duration_mins + addonDuration

  const now = Date.now()
  const maxAdvance = settings.max_advance_days
  // Fetch busy spans across the whole window the generator can offer: from a
  // buffer before now (a just-ended booking still blocks nearby slots) through
  // past the last generated day (+ slack so late studio-local slots on that
  // day, which fall on the next UTC day, are still covered).
  const windowStart = new Date(now - settings.buffer_mins * MIN).toISOString()
  const lastDay = studioDayNumber(now) + maxAdvance
  const windowEnd = new Date((lastDay + 2) * DAY_MS).toISOString()
  // Every booking blocks a slot, not just the caller's — and `bookings` is
  // RLS-private (anon reads nothing). Read spans with service-role; only the
  // times cross back into the pure generator, never any booking PII.
  const spans = await listActiveBookingSpansBetween(
    createSupabaseServiceRoleClient(),
    windowStart,
    windowEnd,
  )

  return {
    settings,
    schedule,
    outsideEnabled,
    durationMins,
    now,
    maxAdvance,
    busy: spans.map((b) => ({
      start: new Date(b.start_time).getTime(),
      end: new Date(b.end_time).getTime(),
    })),
  }
}

// Run the pure generator for one mode against already-loaded inputs.
function generateFor(inputs: SlotInputs, opts: SlotOpts): Slot[] {
  const { settings, schedule, durationMins, now, maxAdvance, busy } = inputs

  return generateSlots({
    schedule,
    mode: opts.outsideHours ? "outside" : "standard",
    durationMins,
    busy,
    rules: {
      slotIntervalMins: settings.slot_interval_mins,
      bufferMins: settings.buffer_mins,
      minLeadMins:
        opts.ignoreLeadTime || opts.outsideHours || opts.override
          ? 0
          : settings.min_lead_mins,
      maxAdvanceDays: maxAdvance,
    },
    now,
    // Override ignores the schedule entirely — the whole envelope, every day.
    fullDayWindow: opts.override ? OVERRIDE_WINDOW : undefined,
  })
}

function logSlotError(error: unknown): void {
  console.error(
    "[availability] slot load failed",
    error instanceof Error ? error.message : error,
  )
}
