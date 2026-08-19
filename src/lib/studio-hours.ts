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

/**
 * Resolve the opening hours for one date: a matching special day wins (closed,
 * or its special hours), otherwise the weekday's weekly hours. The date is
 * treated as studio-local (the scheduler passes a studio-local date).
 */
export function hoursForDate(hours: StudioHours, date: Date): DayHours {
  const iso = isoDate(date)
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
  const ranges = hours.weekly[WEEKDAY_BY_JS[date.getDay()]] ?? []
  return { closed: ranges.length === 0, ranges }
}
