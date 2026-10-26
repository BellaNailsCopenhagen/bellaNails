import type { Db } from "@/db/client"
import { getBookingSettings } from "@/db/booking-settings"
import { listActiveBookingSpansBetween } from "@/db/bookings"
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
import { resolveBookingSubject } from "@/modules/booking/subject"
import type { SubjectRef } from "@/shared/booking-subject"

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
 * Free start times for a booking SUBJECT — a catalog service (+ add-ons) or a
 * one-time offer. Public-read (anon client); composes the global rules, the
 * subject's length, the studio schedule and existing bookings, then runs the
 * pure slot generator. Degrades to [] (missing config, or a transient read
 * error) so the UI shows "no times" rather than crashing.
 */
export async function getAvailableSlots(
  ref: SubjectRef,
  db: Db = createSupabaseServerClient(),
  // Owner reschedule places bookings free of the public 24 h lead time.
  opts?: { ignoreLeadTime?: boolean },
): Promise<Slot[]> {
  const durationMins = await durationFor(ref, db)
  if (durationMins === null) {
    return []
  }

  return getSlotsForDuration(durationMins, db, {
    ignoreLeadTime: opts?.ignoreLeadTime,
  })
}

/**
 * Free start times for an appointment of a KNOWN length. This is the primitive —
 * `getAvailableSlots` is it plus a subject lookup. Reschedule uses it directly
 * with the AS-BOOKED duration, so a moved appointment is validated against the
 * footprint it actually occupies, not whatever the catalog says today.
 */
export async function getSlotsForDuration(
  durationMins: number,
  db: Db = createSupabaseServerClient(),
  opts?: { ignoreLeadTime?: boolean },
): Promise<Slot[]> {
  return computeSlots(durationMins, db, {
    ignoreLeadTime: opts?.ignoreLeadTime,
  })
}

/**
 * Both booking calendars for the /book confirm step in ONE pass — the shared
 * inputs (settings, schedule, busy scan) are fetched once and fed to two
 * generators, instead of running the whole pipeline twice.
 */
export async function getBookingSlots(
  ref: SubjectRef,
  db: Db = createSupabaseServerClient(),
): Promise<{ normal: Slot[]; outsideEnabled: boolean }> {
  const empty = { normal: [], outsideEnabled: false }
  try {
    const durationMins = await durationFor(ref, db)
    if (durationMins === null) {
      return empty
    }
    const inputs = await loadSlotInputs(durationMins, db)
    if (!inputs) {
      return empty
    }

    return {
      normal: generateFor(inputs, {}),
      // The flag drives the UI affordance, independent of whether outside slots
      // exist right now. The slots themselves are NOT returned here: they back
      // a picker behind a "Can't find a time?" button, so shipping them to
      // every booking visitor sends a calendar almost nobody opens. See
      // `getOutsideSlots`.
      outsideEnabled: inputs.outsideEnabled,
    }
  } catch (error) {
    logSlotError(error)

    return empty
  }
}

/**
 * ADMIN OVERRIDE free times — every day within the override envelope, with the
 * studio hours / no-work / lead time ignored, but still MINUS existing bookings
 * so the artist can only pick a genuinely free slot. Owner-gate at the caller.
 */
/**
 * The outside-hours calendar, fetched only once the visitor asks for it.
 *
 * Split out of `getBookingSlots` because it backs a picker behind a "Can't find
 * a time?" button: bundling it into the page meant every booking visitor
 * downloaded a calendar almost none of them would open, and the size grows with
 * however generously the artist draws her requestable blocks. Returns [] when
 * the feature is off, so the caller needs no second check.
 */
export async function getOutsideSlots(
  ref: SubjectRef,
  db: Db = createSupabaseServerClient(),
): Promise<Slot[]> {
  try {
    const durationMins = await durationFor(ref, db)
    if (durationMins === null) {
      return []
    }
    const inputs = await loadSlotInputs(durationMins, db)
    if (!inputs?.outsideEnabled) {
      return []
    }

    return generateFor(inputs, { outsideHours: true })
  } catch (error) {
    logSlotError(error)

    return []
  }
}

export async function getOverrideSlots(
  ref: SubjectRef,
  db: Db,
): Promise<Slot[]> {
  const durationMins = await durationFor(ref, db)
  if (durationMins === null) {
    return []
  }

  return getOverrideSlotsForDuration(durationMins, db)
}

/** The override primitive, for callers that already know the length — moving an
    existing booking uses its as-booked duration, not the live catalog. */
export async function getOverrideSlotsForDuration(
  durationMins: number,
  db: Db,
): Promise<Slot[]> {
  return computeSlots(durationMins, db, { override: true })
}

/** The subject's length, or null when it can't be resolved (unknown service,
    withdrawn/expired offer) — callers degrade to "no times". */
async function durationFor(ref: SubjectRef, db: Db): Promise<number | null> {
  const resolved = await resolveBookingSubject(db, ref).catch(() => null)

  return resolved?.ok ? resolved.subject.durationMins : null
}

type SlotOpts = {
  ignoreLeadTime?: boolean
  outsideHours?: boolean
  override?: boolean
}

async function computeSlots(
  durationMins: number,
  db: Db,
  opts: SlotOpts,
): Promise<Slot[]> {
  try {
    const inputs = await loadSlotInputs(durationMins, db)
    if (!inputs) {
      return []
    }
    // Outside-hours requests only exist when the artist has enabled them.
    if (opts.outsideHours && !inputs.outsideEnabled) {
      return []
    }

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
  durationMins: number,
  db: Db,
): Promise<SlotInputs | null> {
  const [settings, schedule, outsideEnabled] = await Promise.all([
    getBookingSettings(db),
    // Both self-degrade (empty schedule / flag off), so a missing migration shows
    // "no times" rather than crashing the booking flow.
    getSchedule(db),
    isFeatureEnabled(FEATURE_FLAGS.outsideHoursRequests, db),
  ])
  if (!settings) {
    return null
  }

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
