"use server"

import { getCurrentUser } from "@/lib/identity/server"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

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

  const admin = createSupabaseServiceRoleClient()
  const { data, error } = await admin
    .from("clients")
    .update({
      name: name || null,
      phone: phone || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select("id")
  if (error) return { ok: false, error: error.message }
  if (!data?.length) return { ok: false, error: "profile not found" }
  return { ok: true }
}
