import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

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
 * Existing rows are filled-if-empty — booking data never clobbers what a client
 * set themselves. Used by the Cal webhook sync and the booking-flow opt-in.
 */
export async function ensureUser({
  email,
  name,
  phone,
}: EnsureUserInput): Promise<string> {
  const supabase = createSupabaseServiceRoleClient()
  const normalizedEmail = email.trim().toLowerCase()

  const { data: existing } = await supabase
    .from("clients")
    .select("id, name, phone")
    .eq("email", normalizedEmail)
    .maybeSingle()

  if (existing) {
    const patch: { name?: string; phone?: string } = {}
    if (!existing.name && name) patch.name = name
    if (!existing.phone && phone) patch.phone = phone
    if (Object.keys(patch).length) {
      await supabase.from("clients").update(patch).eq("id", existing.id)
    }
    return existing.id
  }

  const { data: created, error } = await supabase
    .from("clients")
    .insert({ email: normalizedEmail, name: name ?? null, phone: phone ?? null })
    .select("id")
    .single()
  if (created) return created.id

  // create-then-find race: a concurrent login/booking inserted it first.
  const { data: raced } = await supabase
    .from("clients")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle()
  if (raced) return raced.id
  throw error ?? new Error("ensureUser: could not create client")
}
