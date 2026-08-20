import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import type { ClientContact } from "@/lib/clerk/contact"

/**
 * Batch-resolve `client_id → contact` from the `clients` table. A failure
 * degrades to an empty map (cards show "Client") rather than throwing. Replaces
 * the former Clerk Backend API lookup; the client-safe `ClientContact` type +
 * `contactDisplayName` still live in `contact.ts`.
 */
export async function fetchClientContacts(
  clientIds: (string | null | undefined)[],
): Promise<Record<string, ClientContact>> {
  const ids = [...new Set(clientIds.filter((id): id is string => Boolean(id)))]
  if (ids.length === 0) return {}

  const contacts: Record<string, ClientContact> = {}
  try {
    const supabase = createSupabaseServiceRoleClient()
    const { data } = await supabase
      .from("clients")
      .select("id, name, email, phone, auth_user_id")
      .in("id", ids)
    for (const c of data ?? []) {
      const firstName = c.name?.trim().split(/\s+/)[0] ?? null
      contacts[c.id] = {
        firstName,
        fullName: c.name,
        email: c.email,
        phone: c.phone,
        // Has logged in at least once (auth_user_id linked) vs a guest stub.
        activated: c.auth_user_id != null,
      }
    }
  } catch (error) {
    console.error(
      "[contacts] resolution failed",
      error instanceof Error ? error.message : error,
    )
  }
  return contacts
}
