import {
  effectiveRangesForDayNumber,
  type StudioHours,
  type TimeRange,
  type WeeklyHours,
} from "@/shared/studio-hours"
import { studioDayNumber, studioWallTimeToInstant } from "@/shared/studio-time"

/**
 * Pure slot generation — inputs in, free start times out. No vendor, no DB.
 * Generates candidate starts in studio wall-clock (via studioWallTimeToInstant,
 * DST-correct) and returns UTC ISO instants; the caller stores UTC.
 */

export type Slot = { start: string; end: string } // UTC ISO
export type BusySpan = { start: number; end: number } // ms

/** Admin override envelope — the daily bounds the "ignore all limits" picker
    offers on EVERY day (hours/no-work ignored, busy still excluded). Shared so
    the server generator and the client labels can't drift apart. */
export const OVERRIDE_WINDOW: TimeRange = ["06:00", "22:00"]
/** Display form of the override window for picker labels. */
export const OVERRIDE_WINDOW_LABEL = `${OVERRIDE_WINDOW[0]}–${OVERRIDE_WINDOW[1]}`
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
  /** Weekly no-work blocks carved out of every day (both modes). */
  noWork?: WeeklyHours
  /** Set → OUTSIDE-hours mode: slots in the complement of standard hours within
      this window (the request calendar), instead of the standard hours. */
  outerWindow?: TimeRange
  /** Set → ADMIN OVERRIDE: every day is this whole window (hours / no-work /
      special ignored), still minus `busy` — free times only, any day. */
  fullDayWindow?: TimeRange
}): Slot[] {
  const { hours, durationMins, busy, rules, now, noWork, outerWindow, fullDayWindow } =
    params
  const earliest = now + rules.minLeadMins * MIN
  const buffer = rules.bufferMins * MIN
  const step = rules.slotIntervalMins * MIN
  const length = durationMins * MIN

  const firstDay = studioDayNumber(now)
  const lastDay = firstDay + rules.maxAdvanceDays
  const slots: Slot[] = []

  for (let day = firstDay; day <= lastDay; day++) {
    // Override: the whole window every day, hours/no-work/special ignored — only
    // `busy` (below) still carves out taken time. Else the normal effective ranges.
    const dayHours = fullDayWindow
      ? { closed: false as const, ranges: [fullDayWindow] }
      : effectiveRangesForDayNumber(hours, day, { outerWindow, noWork })
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
