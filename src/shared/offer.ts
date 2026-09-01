/**
 * The one-time offer, as a pure rule. An offer is the artist's answer to a
 * design request: a duration and price set for that job, reachable through a signed link and
 * bookable exactly once.
 *
 * Client-safe, so the same predicate decides what the client's page renders,
 * what the admin card renders, and whether the booking engine will accept it —
 * there is no second definition of "is this offer still good?". The wording for
 * each state lives in the next-intl catalogs, keyed by the state name.
 */
export type OfferState = "live" | "withdrawn" | "used" | "expired"

/** The states that stop a client booking — each needs a reason in the catalogs. */
export const OFFER_STATES_BLOCKED = [
  "withdrawn",
  "used",
  "expired",
] as const satisfies readonly Exclude<OfferState, "live">[]

/** The fields state depends on — structural, so no schema import is needed. */
export type OfferLifecycle = {
  expires_at: string
  booking_id?: string | null
  /** The artist pulled it back. */
  withdrawn_at?: string | null
  /** No longer live for any reason — set by a withdrawal AND by the expiry
      sweep, so one immutable column can drive the one-live-offer index. */
  closed_at?: string | null
}

/** Checked in lifecycle order: an explicit end beats a deadline, and a used
    offer reads as used even after its expiry passes. */
export function offerState(offer: OfferLifecycle, now: number): OfferState {
  if (offer.withdrawn_at) return "withdrawn"
  if (offer.booking_id) return "used"
  if (offer.closed_at) return "expired"
  return new Date(offer.expires_at).getTime() <= now ? "expired" : "live"
}

export const isOfferLive = (offer: OfferLifecycle, now: number): boolean =>
  offerState(offer, now) === "live"

/** How many days an offer holds by default. */
export const OFFER_DEFAULT_DAYS = 14

/** The expiry instant for a new offer, N whole days from `from`. */
export const offerExpiryFrom = (from: number, days: number): string =>
  new Date(from + days * 86_400_000).toISOString()
