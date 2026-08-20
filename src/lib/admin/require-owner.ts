import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { isOwnerUser } from "@/lib/admin/owner"
import { getAuthUser } from "@/lib/identity/server"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"
import type { Database } from "@/platform/supabase/types"

/**
 * The owner gate for admin server actions: returns a service-role client when
 * the caller is the studio owner, else null. Every admin write re-checks this —
 * the UI/proxy is never the authorization boundary. The owner role is in the
 * validated session's `app_metadata` (no clients lookup needed).
 */
export async function requireOwner(): Promise<SupabaseClient<Database> | null> {
  const user = await getAuthUser()
  if (!isOwnerUser(user)) return null
  return createSupabaseServiceRoleClient()
}
