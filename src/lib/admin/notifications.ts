import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * Owner notification reads (service-role, owner-gated route). Degrade-safe: a
 * missing table returns 0 / [] so the admin still renders before the migration.
 */

export type OwnerNotification = {
  id: string
  kind: string
  clerkUserId: string
  clientMediaId: string | null
  purpose: string | null
  createdAt: string
  readAt: string | null
}

export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = createSupabaseServiceRoleClient()
  const { count, error } = await supabase
    .from("owner_notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null)
  if (error) return 0
  return count ?? 0
}

export async function getNotifications(limit = 50): Promise<OwnerNotification[]> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("owner_notifications")
    .select(
      "id, kind, clerk_user_id, client_media_id, purpose, created_at, read_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) return []
  return (data ?? []).map((n) => ({
    id: n.id,
    kind: n.kind,
    clerkUserId: n.clerk_user_id,
    clientMediaId: n.client_media_id,
    purpose: n.purpose,
    createdAt: n.created_at,
    readAt: n.read_at,
  }))
}
