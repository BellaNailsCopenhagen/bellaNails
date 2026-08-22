import "server-only"

import {
  findClientByEmail,
  findClientIdByEmail,
  insertClient,
  updateClientContact,
} from "@/db/clients"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"

type EnsureUserInput = {
  email: string
  /** Full display name as typed by the client ("Anna Jensen"). */
  name?: string
  /** Phone as typed by the client. */
  phone?: string
}

/**
 * Create-or-find a `clients` row by email; returns the client_id — the keystone
 * of the identity model. A guest booker gets an identity + history with no
 * login; a later Google/OTP login links this row by email (the
 * on_auth_user_created trigger sets auth_user_id).
 *
 * Name is filled-if-empty (a booking typo never clobbers a client's chosen
 * display name); phone is refreshed to the latest one they book with, since a
 * booking gives the current contact number. Used by the booking flow.
 */
export async function ensureUser({
  email,
  name,
  phone,
}: EnsureUserInput): Promise<string> {
  const supabase = createSupabaseServiceRoleClient()
  const normalizedEmail = email.trim().toLowerCase()

  const existing = await findClientByEmail(supabase, normalizedEmail)
  if (existing) {
    const patch: { name?: string; phone?: string } = {}
    if (!existing.name && name) patch.name = name
    if (phone && phone !== existing.phone) patch.phone = phone
    if (Object.keys(patch).length) {
      await updateClientContact(supabase, existing.id, patch)
    }
    return existing.id
  }

  const created = await insertClient(supabase, {
    email: normalizedEmail,
    name: name ?? null,
    phone: phone ?? null,
  })
  if (created.ok) return created.id

  // create-then-find race: a concurrent login/booking inserted it first.
  const raced = await findClientIdByEmail(supabase, normalizedEmail)
  if (raced) return raced
  throw new Error(`ensureUser: could not create client — ${created.message}`)
}
