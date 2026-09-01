/**
 * Design requests — the vocabulary and the abuse caps. Client-safe: the form,
 * the server action and the admin card all read the same constants, and the
 * wording lives in the next-intl catalogs keyed by these values.
 */

/** What a client is writing in about. Drives the form copy and the artist's
    urgency read — a repair is time-sensitive in a way a new design isn't. */
export const DESIGN_TOPICS = ["new_design", "repair", "other"] as const
export type DesignTopic = (typeof DESIGN_TOPICS)[number]

export function isDesignTopic(value: string): value is DesignTopic {
  return (DESIGN_TOPICS as readonly string[]).includes(value)
}

/**
 * The request lifecycle. `open` → the artist hasn't answered; `offered` → a live
 * offer is waiting on the client; `booked` → the offer became an appointment;
 * `declined` → the artist closed it; `expired` → the offer ran out.
 */
export const DESIGN_STATUSES = [
  "open",
  "offered",
  "booked",
  "declined",
  "expired",
] as const
export type DesignStatus = (typeof DESIGN_STATUSES)[number]

/** Statuses still on the artist's plate. */
export const ACTIONABLE_DESIGN_STATUSES: readonly DesignStatus[] = [
  "open",
  "offered",
]

export const isActionableDesignStatus = (status: string): boolean =>
  (ACTIONABLE_DESIGN_STATUSES as readonly string[]).includes(status)

/** Narrow a stored value to the union. The DB has a CHECK constraint, so this
    only ever falls back if the column is ahead of the deployed code. */
export const asDesignStatus = (value: string): DesignStatus =>
  (DESIGN_STATUSES as readonly string[]).includes(value)
    ? (value as DesignStatus)
    : "open"

export const asDesignTopic = (value: string): DesignTopic =>
  isDesignTopic(value) ? value : "other"

// Caps. Sign-in already gates who can write in; these bound what one person can
// pile up, and keep the artist's queue and the storage bill predictable.
export const MAX_OPEN_REQUESTS_PER_CLIENT = 3
export const MAX_REFS_PER_REQUEST = 3
export const MAX_MESSAGE_LENGTH = 2000
export const MAX_PREFERRED_WINDOW_LENGTH = 120

/** Offer duration presets, in minutes — the artist taps rather than types. */
export const OFFER_DURATION_PRESETS = [30, 45, 60, 90, 120, 180] as const
