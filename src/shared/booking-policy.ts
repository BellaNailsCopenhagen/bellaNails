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
  /** Set instead of `serviceId` when the booking came from a one-time offer.
      Both null-able: an offer booking has no catalog service, which is what
      makes it correctly non-rebookable. */
  offerId?: string | null
  addonIds?: string[] | null
  totalDurationMins?: number | null
  // Locale the booking was made in — drives the language of follow-up emails.
  locale?: string | null
  // Historic product snapshot (captured at persist time).
  serviceNameEn?: string | null
  serviceNameDk?: string | null
  serviceDescriptionEn?: string | null
  serviceDescriptionDk?: string | null
  addonSnapshots?:
    { id: string; nameEn: string; nameDk: string | null }[] | null
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
      (isEn
        ? meta.serviceNameEn
        : (meta.serviceNameDk ?? meta.serviceNameEn)) ??
      (isEn ? "Treatment" : "Behandling"),
    addonNames: (meta.addonSnapshots ?? []).map((a) =>
      isEn ? a.nameEn : (a.nameDk ?? a.nameEn),
    ),
  }
}

/**
 * The length a booking actually occupies, from the AS-BOOKED snapshot, falling
 * back to its own start→end span for rows persisted before snapshots existed.
 * Reschedule validates against THIS rather than the live catalog, so a service
 * whose duration changed later can't stretch or shrink an existing appointment —
 * and a booking with no catalog service at all (a one-time offer) still moves.
 */
export function bookedDurationMins(booking: {
  start_time: string
  end_time: string
  selected_addons: unknown
}): number {
  const mins = metaOf(booking).totalDurationMins
  if (typeof mins === "number" && mins > 0) {
    return mins
  }
  const span =
    new Date(booking.end_time).getTime() -
    new Date(booking.start_time).getTime()

  return span > 0 ? Math.round(span / 60_000) : 0
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

/**
 * How many upcoming bookings one client may hold (hands + feet). Beyond it the
 * self-service flow refuses and offers a request instead — which is what makes
 * `over_limit` a checkable claim rather than a label.
 */
export const MAX_ACTIVE_BOOKINGS = 2

/**
 * How many undecided requests one client may hold at once.
 *
 * Each one costs the artist an alert and two emails, and the 5/hour rate limit
 * alone let one person queue five conflicting asks an hour. Three is enough for
 * a real "any of these times?" and few enough to answer.
 */
export const MAX_PENDING_REQUESTS = 3

/**
 * How far ahead a request may name a time. A year and a day, so "same date
 * next year" is never refused by a leap-year rounding error.
 */
export const REQUEST_HORIZON_DAYS = 366

export type RequestTimeProblem = "invalid" | "past" | "tooFar"

/**
 * Why this start time cannot be requested or accepted, or null if it can.
 *
 * A request runs with the slot check OFF — it exists to ask for a time the
 * self-service flow won't grant — so this is the only bound on it, and it has
 * to hold on the way IN and on the way out. Accepting used to check only that
 * the timestamp parsed, so an "Adjust time" sheet left open overnight could
 * turn into a booking in the past with nothing but the overlap constraint in
 * the way.
 */
export function requestTimeProblem(
  startIso: string,
  now: number,
): RequestTimeProblem | null {
  const startMs = new Date(startIso).getTime()
  if (!Number.isFinite(startMs)) {
    return "invalid"
  }
  if (startMs < now) {
    return "past"
  }
  if (startMs > now + REQUEST_HORIZON_DAYS * 24 * 60 * 60 * 1000) {
    return "tooFar"
  }

  return null
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
  if (row.no_show_at) {
    return "no-show"
  }
  if (row.status === BOOKING_STATUS.cancelled) {
    return "cancelled"
  }

  return new Date(row.end_time).getTime() >= now ? "open" : "completed"
}
