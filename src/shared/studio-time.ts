import { STUDIO_TIME_ZONE } from "@/config/studio"

/**
 * Client-facing date/time rendering for appointments: booking times are
 * stored UTC and always displayed in the studio's timezone, localized to the
 * active locale. Shared by /confirmation and /bookings so the same instant
 * can never read differently on two pages.
 */

/** Long editorial date — "Saturday 18 July 2026" / "lørdag den 18. juli 2026". */
export function formatStudioDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: STUDIO_TIME_ZONE,
  }).format(new Date(iso))
}

/** 24h wall-clock time at the studio — "13:30". */
export function formatStudioTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: STUDIO_TIME_ZONE,
  }).format(new Date(iso))
}

// Fixed configuration — build once, not per call.
const STUDIO_DAY_FORMAT = new Intl.DateTimeFormat("en", {
  timeZone: STUDIO_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
})

/** Days since epoch of the instant's calendar date IN THE STUDIO TIMEZONE —
    the unit people mean by "in 3 days". Extracted via formatToParts so no
    locale's date ordering is involved: year/month/day are read by name. */
export function studioDayNumber(ms: number): number {
  const parts = STUDIO_DAY_FORMAT.formatToParts(new Date(ms))
  const get = (type: "year" | "month" | "day") =>
    Number(parts.find((part) => part.type === type)?.value)
  return Date.UTC(get("year"), get("month") - 1, get("day")) / 86_400_000
}

/** Day-number of the Monday starting the studio-week that contains `dayNumber`.
    Weeks start Monday (Copenhagen convention). Epoch day 0 (1970-01-01) was a
    Thursday, so the Monday-based weekday index is `(dayNumber + 3) % 7`. */
export function studioWeekStartDayNumber(dayNumber: number): number {
  return dayNumber - ((dayNumber + 3) % 7)
}

/** Noon-UTC instant for a studio day-number — safe to format as that calendar
    day in the studio timezone regardless of DST (never near a midnight edge). */
export function dayNumberToMs(dayNumber: number): number {
  return dayNumber * 86_400_000 + 43_200_000
}

/** Weekday name in studio time — "Saturday" / "lørdag". */
export function formatStudioWeekday(ms: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    timeZone: STUDIO_TIME_ZONE,
  }).format(new Date(ms))
}

/** Short weekday in studio time — "Mon" / "man." (calendar column headers). */
export function formatStudioWeekdayShort(ms: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: STUDIO_TIME_ZONE,
  }).format(new Date(ms))
}

/** Studio day-number for a studio-local calendar date — the inverse of the
    Y/M/D that `studioDayNumber` yields. Month is 1-based. Used to lay out a
    calendar month grid entirely in day-numbers. */
export function studioDayNumberForDate(
  year: number,
  month: number,
  day: number,
): number {
  return Date.UTC(year, month - 1, day) / 86_400_000
}

/** Short day + month in studio time — "18 Jul". */
export function formatStudioDayMonth(ms: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: STUDIO_TIME_ZONE,
  }).format(new Date(ms))
}

/** Day, short month, and year in studio time — "18 Jul 2026" (history rows). */
export function formatStudioDayMonthYear(ms: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: STUDIO_TIME_ZONE,
  }).format(new Date(ms))
}

/** Studio-local year and 1-based month of an instant (for the calendar grid). */
export function studioYearMonth(ms: number): { year: number; month: number } {
  const parts = STUDIO_DAY_FORMAT.formatToParts(new Date(ms))
  const get = (type: "year" | "month") =>
    Number(parts.find((part) => part.type === type)?.value)
  return { year: get("year"), month: get("month") }
}

/** Full month + year in studio time — "July 2026". */
export function formatStudioMonthYear(ms: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: STUDIO_TIME_ZONE,
  }).format(new Date(ms))
}

/**
 * Localized countdown to an instant — "in 3 days" / "om 3 dage",
 * "in 11 hours", "in 40 minutes". Under an hour → minutes; under 24 h →
 * hours (even across midnight — the final-day countdown matters more than
 * the date line); beyond that → CALENDAR-day difference in studio time, so
 * two bookings on the same date always agree. Pass the request timestamp so
 * one page renders one consistent "now".
 */
export function formatCountdown(
  iso: string,
  locale: string,
  now: number,
): string {
  const target = new Date(iso).getTime()
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })

  const diffMins = Math.round((target - now) / 60_000)
  if (Math.abs(diffMins) < 60) return rtf.format(diffMins, "minute")
  if (Math.abs(diffMins) < 24 * 60) {
    return rtf.format(Math.round(diffMins / 60), "hour")
  }

  return rtf.format(studioDayNumber(target) - studioDayNumber(now), "day")
}

// Wall-clock parts of an instant in the studio timezone — the inverse input to
// studioWallTimeToInstant's offset calculation.
const STUDIO_WALL_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: STUDIO_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})

/** ISO instant → a `datetime-local` input value ("YYYY-MM-DDTHH:mm") in STUDIO
    time. Pure (fixed TZ) so it renders identically on server and client — no
    hydration mismatch — and always reads as the studio wall-clock. */
export function studioInputValue(iso: string): string {
  const parts = STUDIO_WALL_FORMAT.formatToParts(new Date(iso))
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "00"
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`
}

/** Inverse of `studioInputValue` — a `datetime-local` value interpreted as a
    STUDIO wall-clock → the ISO instant, DST-correct. `null` for a malformed /
    cleared value (so callers guard instead of throwing on `new Date("")`). */
export function studioInputToIso(value: string): string | null {
  // Some browsers append seconds to a datetime-local value — accept + ignore them.
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/.exec(value)
  if (!m) return null
  const [, y, mo, d, hh, mm] = m
  const dayNumber = studioDayNumberForDate(Number(y), Number(mo), Number(d))
  const ms = studioWallTimeToInstant(dayNumber, `${hh}:${mm}`)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

/** UTC instant (ms) for a wall-clock "HH:MM" on a studio day-number —
    DST-correct: the zone offset is computed AT the target instant, so a slot
    generated across a DST boundary lands on the right absolute time. */
export function studioWallTimeToInstant(dayNumber: number, hhmm: string): number {
  const date = new Date(dayNumber * 86_400_000)
  const [hour, minute] = hhmm.split(":").map(Number)
  // The desired wall time read as if it were UTC…
  const asUtc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    hour,
    minute,
  )
  // …then correct by however far the zone is from UTC at that instant.
  const parts = STUDIO_WALL_FORMAT.formatToParts(new Date(asUtc))
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value)
  const shown = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  )
  return asUtc - (shown - asUtc)
}
