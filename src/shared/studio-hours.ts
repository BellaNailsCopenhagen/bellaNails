// Client-safe: pure range + weekday primitives for the schedule engine. No
// server imports. The schedule model + resolver live in `@/shared/schedule`.

/** A local "HH:MM" open→close pair. Multiple pairs on a day = a split shift. */
export type TimeRange = [string, string]

export type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"

export const WEEKDAYS: { key: WeekdayKey; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
]

/** The resolved hours for one day: closed, or the open ranges to honour. */
export type DayHours = { closed: boolean; ranges: TimeRange[]; label?: string }

/** Studio-local ISO date (YYYY-MM-DD) for a day-number (days since epoch). */
export function isoForDayNumber(dayNumber: number): string {
  return new Date(dayNumber * 86_400_000).toISOString().slice(0, 10)
}

/** The inverse: a day-number for a "YYYY-MM-DD" date. */
export function dayNumberForIso(iso: string): number {
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000)
}

/** Weekday index 0=Mon..6=Sun for a day-number. Epoch day 0 (1970-01-01) was a
    Thursday, hence the +3 offset. */
export function weekdayIndexForDayNumber(dayNumber: number): number {
  return (dayNumber + 3) % 7
}

// ── Range arithmetic (pure, "HH:MM" in / out) ────────────────────────────────
export const toMinutes = (clock: string): number => {
  const [hours, mins] = clock.split(":").map(Number)

  return hours * 60 + mins
}
export const toClock = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`

/** Merge overlapping/adjacent ranges into a normalised, sorted set. */
export function unionRanges(ranges: TimeRange[]): TimeRange[] {
  const sorted = ranges
    .map((r) => [toMinutes(r[0]), toMinutes(r[1])] as [number, number])
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0])

  const merged: [number, number][] = []
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1]
    if (last && start <= last[1]) {
      last[1] = Math.max(last[1], end)
    } else {
      merged.push([start, end])
    }
  }

  return merged.map(([start, end]) => [toClock(start), toClock(end)])
}

/** `ranges` with every `blocks` interval carved out. */
export function subtractRanges(
  ranges: TimeRange[],
  blocks: TimeRange[],
): TimeRange[] {
  let remaining = ranges.map(
    (range) => [toMinutes(range[0]), toMinutes(range[1])] as [number, number],
  )
  for (const block of blocks) {
    const blockStart = toMinutes(block[0])
    const blockEnd = toMinutes(block[1])
    const next: [number, number][] = []
    for (const [start, end] of remaining) {
      if (blockEnd <= start || blockStart >= end) {
        next.push([start, end]) // no overlap — keep as is
        continue
      }
      if (blockStart > start) {
        next.push([start, blockStart])
      } // part before the block
      if (blockEnd < end) {
        next.push([blockEnd, end])
      } // part after the block
    }
    remaining = next
  }

  return remaining
    .filter(([start, end]) => end > start)
    .map(([start, end]) => [toClock(start), toClock(end)])
}
