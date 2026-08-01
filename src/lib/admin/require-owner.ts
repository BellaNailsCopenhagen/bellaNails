import "server-only"

import { auth } from "@clerk/nextjs/server"
import type { SupabaseClient } from "@supabase/supabase-js"

import { isOwner } from "@/lib/admin/owner"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/types"

/**
 * The owner gate for admin server actions: returns a service-role client when
 * the caller is the studio owner, else null. Every admin write re-checks this —
 * the UI/proxy is never the authorization boundary.
 */
export async function requireOwner(): Promise<SupabaseClient<Database> | null> {
  const { userId, sessionClaims } = await auth()
  if (!userId || !isOwner(sessionClaims)) return null
  return createSupabaseServiceRoleClient()
}
