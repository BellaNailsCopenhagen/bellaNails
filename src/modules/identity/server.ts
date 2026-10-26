import "server-only"

import { cache } from "react"
import type { User } from "@supabase/supabase-js"

import { isOwnerUser } from "@/modules/identity/owner"
import { findClientByAuthUser } from "@/db/clients"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"
import { createSupabaseSessionServerClient } from "@/platform/supabase/ssr-server"
import type { AppUser } from "@/shared/app-user"

/**
 * The validated Supabase user (network-verified via getUser — never trust the
 * unverified cookie), memoized per request. Null when signed out.
 */
export const getAuthUser = cache(async (): Promise<User | null> => {
  const supabase = await createSupabaseSessionServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
})

/**
 * The signed-in app user: the `clients` row linked to the auth user (by email,
 * via the on_auth_user_created trigger) plus owner role from app_metadata.
 * `id` is the client_id every client-own query filters on. Memoized per request.
 * Provider-agnostic seam — callers never touch the auth provider directly.
 */
export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const user = await getAuthUser()
  if (!user) {
    return null
  }
  const client = await findClientByAuthUser(
    createSupabaseServiceRoleClient(),
    user.id,
  )
  // The login trigger should always link a clients row; if not, id falls back to
  // the auth uid (client-own queries then return empty) — log the anomaly.
  if (!client) {
    console.warn("[identity] no clients row for auth user", user.id)
  }

  return {
    id: client?.id ?? user.id,
    isOwner: isOwnerUser(user),
    email: user.email ?? null,
    name: client?.name ?? null,
    phone: client?.phone ?? null,
  }
})
