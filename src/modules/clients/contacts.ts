import "server-only"

import { listClientContacts } from "@/db/clients"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"
import type { ClientContact } from "@/shared/contact"

/**
 * Batch-resolve `client_id → contact` from the `clients` table. A failure
 * degrades to an empty map (cards show "Client") rather than throwing. The
 * client-safe `ClientContact` type + `contactDisplayName` live in `contact.ts`.
 */
export async function fetchClientContacts(
  clientIds: (string | null | undefined)[],
): Promise<Record<string, ClientContact>> {
  const ids = [...new Set(clientIds.filter((id): id is string => Boolean(id)))]
  if (ids.length === 0) return {}

  const contacts: Record<string, ClientContact> = {}
  try {
    const data = await listClientContacts(createSupabaseServiceRoleClient(), ids)
    for (const c of data) {
      // Anonymized clients expose nothing (GDPR erasure).
      if (c.anonymized_at) {
        contacts[c.id] = {
          firstName: null,
          fullName: null,
          email: null,
          phone: null,
          activated: false,
          anonymized: true,
        }
        continue
      }
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
