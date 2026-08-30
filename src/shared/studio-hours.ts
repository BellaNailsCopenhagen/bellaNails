// Client-safe: pure types + helpers, no server imports (the editor imports
// WEEKDAYS/hoursForDate). The DB read lives in services/get-studio-hours.ts.

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

// JS getDay() (0=Sun … 6=Sat) → our weekday key.
const WEEKDAY_BY_JS: WeekdayKey[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
]

/** Weekly schedule: weekday → time pairs. An absent day means closed. */
export type WeeklyHours = Partial<Record<WeekdayKey, TimeRange[]>>

export type SpecialDay = {
  id: string
  startsOn: string // YYYY-MM-DD
  endsOn: string | null // inclusive range end; null = single day
  closed: boolean
  hours: TimeRange[] | null // special open hours when not closed
  label: string | null
}

export type StudioHours = { weekly: WeeklyHours; special: SpecialDay[] }

/** The resolved hours for one date: closed, or the open ranges to honour. */
export type DayHours = { closed: boolean; ranges: TimeRange[]; label?: string }

/** Local YYYY-MM-DD for a date (its own local components). */
function isoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** Special-day match wins (closed, or its special hours), else the weekday's
    weekly hours. The one body shared by both resolvers below. */
function resolveDayHours(
  hours: StudioHours,
  iso: string,
  weekday: WeekdayKey,
): DayHours {
  const special = hours.special.find(
    (s) => iso >= s.startsOn && iso <= (s.endsOn ?? s.startsOn),
  )
  if (special) {
    return {
      closed: special.closed,
      ranges: special.closed ? [] : (special.hours ?? []),
      label: special.label ?? undefined,
    }
  }
  const ranges = hours.weekly[weekday] ?? []
  return { closed: ranges.length === 0, ranges }
}

/** Opening hours for one date, treated as studio-local (the editor passes a
    studio-local date). */
export function hoursForDate(hours: StudioHours, date: Date): DayHours {
  return resolveDayHours(hours, isoDate(date), WEEKDAY_BY_JS[date.getDay()])
}

// Weekday order, derived from WEEKDAYS so it can't drift. 0 = Monday; epoch day
// 0 (1970-01-01) was a Thursday, hence the (dayNumber + 3) offset below.
const WEEKDAY_BY_INDEX: WeekdayKey[] = WEEKDAYS.map((w) => w.key)

// ── Range arithmetic (pure, "HH:MM" in / out) — for no-work blocks + the ───────
// outside-hours (complement of standard hours) request calendar. ──────────────
const toMinutes = (clock: string): number => {
  const [hours, mins] = clock.split(":").map(Number)
  return hours * 60 + mins
}
const toClock = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`

/** The parts of `outer` NOT covered by `ranges` — the studio's OUTSIDE-hours
    within the outer window. Empty `ranges` (a closed day) → the whole window. */
export function complementRanges(
  outer: TimeRange,
  ranges: TimeRange[],
): TimeRange[] {
  const windowStart = toMinutes(outer[0])
  const windowEnd = toMinutes(outer[1])
  if (windowEnd <= windowStart) return []

  const sortedRanges = ranges
    .map((range) => [toMinutes(range[0]), toMinutes(range[1])] as [number, number])
    .filter(([start, end]) => end > windowStart && start < windowEnd)
    .sort((a, b) => a[0] - b[0])

  const free: TimeRange[] = []
  let coveredUntil = windowStart
  for (const [start, end] of sortedRanges) {
    if (start > coveredUntil) {
      free.push([toClock(coveredUntil), toClock(Math.min(start, windowEnd))])
    }
    coveredUntil = Math.max(coveredUntil, end)
    if (coveredUntil >= windowEnd) break
  }
  if (coveredUntil < windowEnd) {
    free.push([toClock(coveredUntil), toClock(windowEnd)])
  }
  return free
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
      if (blockStart > start) next.push([start, blockStart]) // part before the block
      if (blockEnd < end) next.push([blockEnd, end]) // part after the block
    }
    remaining = next
  }
  return remaining
    .filter(([start, end]) => end > start)
    .map(([start, end]) => [toClock(start), toClock(end)])
}

/** The effective bookable ranges for a day, for the slot generator:
    - normal (no `outerWindow`): the standard resolved hours;
    - outside-hours (`outerWindow` set): the COMPLEMENT of standard hours within
      the window, with a special-closed day staying closed.
    In both, the weekday's `noWork` blocks are carved out (they hide everywhere). */
export function effectiveRangesForDayNumber(
  hours: StudioHours,
  dayNumber: number,
  opts: { outerWindow?: TimeRange; noWork?: WeeklyHours } = {},
): DayHours {
  const iso = new Date(dayNumber * 86_400_000).toISOString().slice(0, 10)
  const weekday = WEEKDAY_BY_INDEX[(dayNumber + 3) % 7]
  const standard = resolveDayHours(hours, iso, weekday)

  let ranges: TimeRange[]
  if (opts.outerWindow) {
    // A special CLOSED day (holiday) is closed for requests too.
    const special = hours.special.find(
      (s) => iso >= s.startsOn && iso <= (s.endsOn ?? s.startsOn),
    )
    if (special?.closed) return { closed: true, ranges: [] }
    ranges = complementRanges(opts.outerWindow, standard.ranges)
  } else {
    if (standard.closed) return { closed: true, ranges: [] }
    ranges = standard.ranges
  }

  const blocks = opts.noWork?.[weekday] ?? []
  if (blocks.length) ranges = subtractRanges(ranges, blocks)
  return { closed: ranges.length === 0, ranges }
}
