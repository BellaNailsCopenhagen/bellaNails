/**
 * Client-safe contact shape + display helper. Kept separate from
 * `client-contacts.ts` (which is `server-only` — it uses the service-role
 * Supabase client) so client components can import the type and name helper.
 */
export type ClientContact = {
  firstName: string | null
  fullName: string | null
  email: string | null
  phone: string | null
  /** The client has signed into their own account (not just a booking-
      provisioned stub) — so outreach outside a booking is on firmer footing.
      Derived from a linked `auth_user_id` (see client-contacts.ts). */
  activated: boolean
}

/** Preferred display name for a booking's client: first name, then full name,
    then a neutral fallback. One definition so admin surfaces agree. */
export function contactDisplayName(contact: ClientContact | undefined): string {
  return contact?.firstName || contact?.fullName || "Client"
}
