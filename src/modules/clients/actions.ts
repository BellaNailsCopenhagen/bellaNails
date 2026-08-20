"use server"

import { getCurrentUser } from "@/modules/identity/server"
import { updateClientProfile } from "@/db/clients"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"

export type ProfileResult = { ok: true } | { ok: false; error: string }

const MAX_NAME = 100
const MAX_PHONE = 40

/** A signed-in client edits their own name + phone (My space). */
export async function updateMyProfile(input: {
  name: string
  phone: string
}): Promise<ProfileResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "not signed in" }

  const name = input.name.trim()
  const phone = input.phone.trim()
  if (name.length > MAX_NAME) return { ok: false, error: "Name is too long." }
  if (phone.length > MAX_PHONE) return { ok: false, error: "Phone is too long." }

  const saved = await updateClientProfile(createSupabaseServiceRoleClient(), user.id, {
    name: name || null,
    phone: phone || null,
  })
  if (!saved.ok) return { ok: false, error: saved.message ?? "failed" }
  return { ok: true }
}
