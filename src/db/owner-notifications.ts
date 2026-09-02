import type { Db, Row } from "./client"

/** `owner_notifications` — the studio's own inbox. `read_at` null means unread;
    `target_id` is the row the alert is ABOUT, so tapping it lands on the item. */

export type NotificationRow = Pick<
  Row<"owner_notifications">,
  | "id"
  | "kind"
  | "client_id"
  | "client_media_id"
  | "target_id"
  | "purpose"
  | "created_at"
  | "read_at"
>

export async function countUnread(db: Db): Promise<number> {
  const { count, error } = await db
    .from("owner_notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null)
  if (error) return 0
  return count ?? 0
}

export async function listNotifications(
  db: Db,
  limit: number,
): Promise<NotificationRow[]> {
  const { data, error } = await db
    .from("owner_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) return []
  return data ?? []
}

export async function insertNotification(
  db: Db,
  values: {
    kind: string
    client_id: string
    client_media_id: string | null
    target_id: string | null
    purpose: string | null
  },
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await db.from("owner_notifications").insert(values)
  return error ? { ok: false, message: error.message } : { ok: true }
}

export async function markAllRead(db: Db): Promise<{ ok: boolean }> {
  const { error } = await db
    .from("owner_notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null)
  return { ok: !error }
}

/** Set one notification read/unread (per-item control on the notifications page). */
export async function setNotificationRead(
  db: Db,
  id: string,
  read: boolean,
): Promise<{ ok: boolean }> {
  const { error } = await db
    .from("owner_notifications")
    .update({ read_at: read ? new Date().toISOString() : null })
    .eq("id", id)
  return { ok: !error }
}

/** Delete EVERY read notification, not just the page's first 50 — the caller
    must say so and confirm. The feed is a to-do list, not history (that lives
    in `communications`). */
export async function deleteReadNotifications(db: Db): Promise<{ ok: boolean }> {
  const { error } = await db
    .from("owner_notifications")
    .delete()
    .not("read_at", "is", null)
  return { ok: !error }
}

/** Remove one notification entirely (dismiss). */
export async function deleteNotification(
  db: Db,
  id: string,
): Promise<{ ok: boolean }> {
  const { error } = await db.from("owner_notifications").delete().eq("id", id)
  return { ok: !error }
}
