import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { isOwnerUser } from "@/modules/identity/owner"
import { getAuthUser } from "@/modules/identity/server"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"
import type { Database } from "@/platform/supabase/types"

/**
 * The owner gate for admin server actions AND for the reads that back admin
 * pages: returns a service-role client when the caller is the studio owner,
 * else null. The UI/proxy is never the authorization boundary. The owner role
 * is in the validated session's `app_metadata` (no clients lookup needed).
 *
 * A read that gets null returns its own empty shape — 0, `[]`, `null` — rather
 * than throwing, matching how every other degradable read in the app behaves.
 * The proxy has already gated `/admin`, so null here means something is badly
 * wrong; an empty screen is the safe answer either way, and the point is that
 * the day one of these reads is put behind an action or a route handler it
 * carries its own gate rather than inheriting one.
 */
export async function requireOwner(): Promise<SupabaseClient<Database> | null> {
  const user = await getAuthUser()
  if (!isOwnerUser(user)) return null
  return createSupabaseServiceRoleClient()
}
