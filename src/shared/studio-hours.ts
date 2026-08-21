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

/**
 * Like `hoursForDate` but keyed by a studio day-number (days since epoch of the
 * studio-local calendar date). Timezone-safe — resolves the weekday and date
 * from day-number arithmetic, never a local `getDay()`, so it's correct
 * regardless of the server's timezone. Used by the slot generator.
 */
export function hoursForDayNumber(
  hours: StudioHours,
  dayNumber: number,
): DayHours {
  const iso = new Date(dayNumber * 86_400_000).toISOString().slice(0, 10)
  return resolveDayHours(hours, iso, WEEKDAY_BY_INDEX[(dayNumber + 3) % 7])
}
