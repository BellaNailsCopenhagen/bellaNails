import type { Db } from "@/db/client"
import { getBookingSettings } from "@/db/booking-settings"
import { listActiveBookingSpansBetween } from "@/db/bookings"
import { getBookableService } from "@/db/services"
import { createSupabaseServerClient } from "@/platform/supabase/server"
import { generateSlots, type Slot } from "@/shared/booking-slots"
import { studioDayNumber } from "@/shared/studio-time"
import { getStudioHours } from "@/modules/studio"

const DAY_MS = 86_400_000
const MIN = 60_000

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
): Promise<Slot[]> {
  try {
    const [settings, service, hours] = await Promise.all([
      getBookingSettings(db),
      getBookableService(db, serviceId),
      getStudioHours(db),
    ])
    if (!settings || !service) return []

    // Total duration = base + the selected add-ons that actually belong to this
    // service and aren't archived (ignore stale/foreign ids from the client).
    const selected = new Set(addonIds)
    const addonDuration = service.service_addons.reduce((sum, { addons }) => {
      if (!addons || addons.archived_at || !selected.has(addons.id)) return sum
      return sum + addons.extra_duration_mins
    }, 0)
    const durationMins = service.base_duration_mins + addonDuration

    const now = Date.now()
    // Fetch busy spans across the whole window the generator can offer: from a
    // buffer before now (a just-ended booking still blocks nearby slots) through
    // past the last generated day (+ slack so late studio-local slots on that
    // day, which fall on the next UTC day, are still covered).
    const windowStart = new Date(now - settings.buffer_mins * MIN).toISOString()
    const lastDay = studioDayNumber(now) + settings.max_advance_days
    const windowEnd = new Date((lastDay + 2) * DAY_MS).toISOString()
    const busySpans = await listActiveBookingSpansBetween(
      db,
      windowStart,
      windowEnd,
    )

    return generateSlots({
      hours,
      durationMins,
      busy: busySpans.map((b) => ({
        start: new Date(b.start_time).getTime(),
        end: new Date(b.end_time).getTime(),
      })),
      rules: {
        slotIntervalMins: settings.slot_interval_mins,
        bufferMins: settings.buffer_mins,
        minLeadMins: settings.min_lead_mins,
        maxAdvanceDays: settings.max_advance_days,
      },
      now,
    })
  } catch (error) {
    console.error(
      "[availability] slot load failed",
      error instanceof Error ? error.message : error,
    )
    return []
  }
}
