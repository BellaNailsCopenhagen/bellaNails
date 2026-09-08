import "server-only"

import { countUnread, listNotifications } from "@/db/owner-notifications"
import { requireOwner } from "@/modules/identity/require-owner"

/**
 * Owner notification reads (service-role, owner-gated route). Degrade-safe: a
 * missing table returns 0 / [] so the admin still renders before the migration.
 */

export type OwnerNotification = {
  id: string
  kind: string
  clientId: string
  /** The row this is about — a design request, a booking request, a testimonial. */
  targetId: string | null
  clientMediaId: string | null
  purpose: string | null
  createdAt: string
  readAt: string | null
}

export async function getUnreadNotificationCount(): Promise<number> {
  const db = await requireOwner()
  if (!db) return 0
  return countUnread(db)
}

export async function getNotifications(limit = 50): Promise<OwnerNotification[]> {
  const db = await requireOwner()
  if (!db) return []
  const data = await listNotifications(db, limit)
  return data.map((n) => ({
    id: n.id,
    kind: n.kind,
    clientId: n.client_id,
    targetId: n.target_id ?? null,
    clientMediaId: n.client_media_id,
    purpose: n.purpose,
    createdAt: n.created_at,
    readAt: n.read_at,
  }))
}
