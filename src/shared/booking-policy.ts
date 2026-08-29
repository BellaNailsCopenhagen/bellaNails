import { BOOKING_STATUS, isActiveBookingStatus } from "@/shared/booking-status"

/**
 * The studio's booking rules as pure predicates. Structural parameter types
 * (not the table row) keep this free of any schema dependency, so the same
 * rule runs in a client component, a server action, and a page.
 */

/** The metadata blob on a booking: the booked selection (service + add-on ids)
    plus a snapshot of the product AS BOOKED, so editing the catalog never
    rewrites old bookings. Old bookings have no snapshot — display falls back to
    the live catalog. */
export type BookingMeta = {
  serviceId?: string | null
  addonIds?: string[] | null
  totalDurationMins?: number | null
  // Locale the booking was made in — drives the language of follow-up emails.
  locale?: string | null
  // Historic product snapshot (captured at persist time).
  serviceNameEn?: string | null
  serviceNameDk?: string | null
  serviceDescriptionEn?: string | null
  serviceDescriptionDk?: string | null
  addonSnapshots?: { id: string; nameEn: string; nameDk: string | null }[] | null
}

export const metaOf = (row: { selected_addons: unknown }) =>
  (row.selected_addons ?? {}) as BookingMeta

/** Localized service + add-on names off the as-booked snapshot — the one place
    the DK/EN precedence and the generic fallback live (booking emails share it). */
export function localizedBookingNames(
  meta: BookingMeta,
  locale: string,
): { serviceName: string; addonNames: string[] } {
  const isEn = locale === "en"
  return {
    serviceName:
      (isEn ? meta.serviceNameEn : meta.serviceNameDk ?? meta.serviceNameEn) ??
      (isEn ? "Treatment" : "Behandling"),
    addonNames: (meta.addonSnapshots ?? []).map((a) =>
      isEn ? a.nameEn : a.nameDk ?? a.nameEn,
    ),
  }
}

/** 24-hour cancellation policy: inside this window the manage actions are
    withheld and the client is pointed at the studio instead. */
export const POLICY_WINDOW_MS = 24 * 60 * 60 * 1000

/** THE eligibility rule for client-side manage actions (reschedule/cancel):
    an active booking starting at least the policy window from now. Every
    surface — card buttons, cancel action, reschedule page — asks this. */
export function canManageBooking(
  row: { status: string; start_time: string },
  now: number,
): boolean {
  return (
    isActiveBookingStatus(row.status) &&
    new Date(row.start_time).getTime() - now >= POLICY_WINDOW_MS
  )
}

/** No-show is markable only once an appointment is well underway — an hour past
    its start (covers finished appointments and long in-progress ones). This is
    studio-side only; it never applies to cancelled bookings. Both the card
    (which reveals the action) and the owner action ask this. */
export const NO_SHOW_GRACE_MS = 60 * 60 * 1000

export function canMarkNoShow(
  row: { status: string; start_time: string },
  now: number,
): boolean {
  return (
    isActiveBookingStatus(row.status) &&
    now >= new Date(row.start_time).getTime() + NO_SHOW_GRACE_MS
  )
}

/** Media capture starts around the appointment — the "request media release" and
    "request review" actions appear on the card from 30 min before the start and
    stay after it ends. Not shown on far-future cards. */
export const MEDIA_REQUEST_LEAD_MS = 30 * 60 * 1000

export function canRequestMediaConsent(
  row: { status: string; start_time: string },
  now: number,
): boolean {
  return (
    isActiveBookingStatus(row.status) &&
    now >= new Date(row.start_time).getTime() - MEDIA_REQUEST_LEAD_MS
  )
}

/** "Request review" appears near the END of the appointment (30 min before it
    finishes) and after — a review only makes sense once the visit is basically
    done. */
export function canRequestReview(
  row: { status: string; end_time: string },
  now: number,
): boolean {
  return (
    isActiveBookingStatus(row.status) &&
    now >= new Date(row.end_time).getTime() - MEDIA_REQUEST_LEAD_MS
  )
}

/** At/above this, a client is a repeat offender (gate + admin share it). */
export const NO_SHOW_ALERT_THRESHOLD = 2

/** The one exclusive, lifecycle-aware state a booking is in — the vocabulary the
    admin status filters classify by. No-show and cancelled win over the
    active statuses; an active booking is `open` until it has happened, then
    `completed` (so an upcoming confirmed booking is never labelled "completed").
    Rescheduled folds into open/completed by date — the "moved" fact stays on
    the card's badge. */
export type BookingState = "open" | "completed" | "cancelled" | "no-show"

export function bookingState(
  row: { status: string; no_show_at: string | null; end_time: string },
  now: number,
): BookingState {
  if (row.no_show_at) return "no-show"
  if (row.status === BOOKING_STATUS.cancelled) return "cancelled"
  return new Date(row.end_time).getTime() >= now ? "open" : "completed"
}
