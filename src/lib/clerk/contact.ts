/**
 * Client-safe contact shape + display helper. Kept separate from
 * `client-contacts.ts` (which is `server-only` because it calls the Clerk
 * Backend API) so client components can import the type and name helper.
 */
export type ClientContact = {
  firstName: string | null
  fullName: string | null
  email: string | null
  phone: string | null
  /** The client has signed into their own account (not just a booking-
      provisioned passwordless one) — so outreach outside a booking is on
      firmer footing. Derived from Clerk's `lastSignInAt`. */
  activated: boolean
}

/** Preferred display name for a booking's client: first name, then full name,
    then a neutral fallback. One definition so admin surfaces agree. */
export function contactDisplayName(contact: ClientContact | undefined): string {
  return contact?.firstName || contact?.fullName || "Client"
}
