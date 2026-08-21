import { hoursForDayNumber, type StudioHours } from "@/shared/studio-hours"
import { studioDayNumber, studioWallTimeToInstant } from "@/shared/studio-time"

/**
 * Pure slot generation — inputs in, free start times out. No vendor, no DB.
 * Generates candidate starts in studio wall-clock (via studioWallTimeToInstant,
 * DST-correct) and returns UTC ISO instants; the caller stores UTC.
 */

export type Slot = { start: string; end: string } // UTC ISO
export type BusySpan = { start: number; end: number } // ms
export type SlotRules = {
  slotIntervalMins: number
  bufferMins: number
  minLeadMins: number
  maxAdvanceDays: number
}

const MIN = 60_000

export function generateSlots(params: {
  hours: StudioHours
  durationMins: number
  busy: BusySpan[]
  rules: SlotRules
  now: number
}): Slot[] {
  const { hours, durationMins, busy, rules, now } = params
  const earliest = now + rules.minLeadMins * MIN
  const buffer = rules.bufferMins * MIN
  const step = rules.slotIntervalMins * MIN
  const length = durationMins * MIN

  const firstDay = studioDayNumber(now)
  const lastDay = firstDay + rules.maxAdvanceDays
  const slots: Slot[] = []

  for (let day = firstDay; day <= lastDay; day++) {
    const dayHours = hoursForDayNumber(hours, day)
    if (dayHours.closed) continue

    for (const [openStr, closeStr] of dayHours.ranges) {
      const open = studioWallTimeToInstant(day, openStr)
      const close = studioWallTimeToInstant(day, closeStr)
      // Step candidate starts; the booking itself must finish by close.
      for (let start = open; start + length <= close; start += step) {
        if (start < earliest) continue
        const end = start + length
        // A buffer-sized gap is required on both sides of every busy span.
        const clash = busy.some(
          (b) => start < b.end + buffer && b.start < end + buffer,
        )
        if (clash) continue
        slots.push({
          start: new Date(start).toISOString(),
          end: new Date(end).toISOString(),
        })
      }
    }
  }
  return slots
}
