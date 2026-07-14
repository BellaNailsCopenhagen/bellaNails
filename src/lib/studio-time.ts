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
