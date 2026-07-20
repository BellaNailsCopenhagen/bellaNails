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
}

/** Preferred display name for a booking's client: first name, then full name,
    then a neutral fallback. One definition so admin surfaces agree. */
export function contactDisplayName(contact: ClientContact | undefined): string {
  return contact?.firstName || contact?.fullName || "Client"
}
