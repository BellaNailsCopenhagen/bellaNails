import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { getCurrentUser } from "@/lib/identity/server"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/types"

/**
 * The owner gate for admin server actions: returns a service-role client when
 * the caller is the studio owner, else null. Every admin write re-checks this —
 * the UI/proxy is never the authorization boundary.
 */
export async function requireOwner(): Promise<SupabaseClient<Database> | null> {
  const user = await getCurrentUser()
  if (!user?.isOwner) return null
  return createSupabaseServiceRoleClient()
}
