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
function studioDayNumber(ms: number): number {
  const parts = STUDIO_DAY_FORMAT.formatToParts(new Date(ms))
  const get = (type: "year" | "month" | "day") =>
    Number(parts.find((part) => part.type === type)?.value)
  return Date.UTC(get("year"), get("month") - 1, get("day")) / 86_400_000
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
