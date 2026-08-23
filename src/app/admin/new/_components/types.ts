import type { ServiceAddon } from "@/modules/catalog"

/** Lean roster entry for the client search step (built server-side). */
export type ClientOption = {
  id: string
  name: string
  /** Lower-cased name + email + digits-only phone haystack (see client-search). */
  search: string
}

/** One bookable service in the picker, with base price + duration for the total. */
export type ServiceOption = {
  id: string
  name: string
  priceCents: number
  durationMins: number
}

/** A category and its bookable services, in menu order. */
export type CategoryGroup = {
  id: string
  name: string
  services: ServiceOption[]
}

/** Who the booking is for — an existing client by id, or a new one by contact.
    Maps straight onto createBookingAsOwner's client fields. */
export type ClientRef =
  | { kind: "existing"; id: string; name: string }
  | { kind: "new"; email: string; name: string; phone: string }

export type { ServiceAddon }
