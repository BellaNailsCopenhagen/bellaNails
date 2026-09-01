/**
 * What a booking is FOR — either a catalog service (with its add-ons) or a
 * one-time offer the artist made for one client. Client-safe: a client
 * component builds a ref and hands it to a server action.
 *
 * This is the only distinction the booking engine draws between the two. Past
 * that point everything runs on a duration and a price, so an offer books
 * through exactly the same slot picker, confirm step and emails as a service.
 */
export type SubjectRef =
  | { kind: "service"; serviceId: string; addonIds: string[] }
  | { kind: "offer"; offerId: string }

export const serviceRef = (
  serviceId: string,
  addonIds: string[] = [],
): SubjectRef => ({ kind: "service", serviceId, addonIds })

export const offerRef = (offerId: string): SubjectRef => ({
  kind: "offer",
  offerId,
})
