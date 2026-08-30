import type { Db, Row } from "./client"

/** `owner_notifications` — the studio's own inbox. `read_at` null means unread;
    there is no per-item read, only "mark all read". */

export type NotificationRow = Pick<
  Row<"owner_notifications">,
  "id" | "kind" | "client_id" | "client_media_id" | "purpose" | "created_at" | "read_at"
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
    .select("id, kind, client_id, client_media_id, purpose, created_at, read_at")
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
    purpose: string | null
  },
): Promise<void> {
  await db.from("owner_notifications").insert(values)
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

/** Remove one notification entirely (dismiss). */
export async function deleteNotification(
  db: Db,
  id: string,
): Promise<{ ok: boolean }> {
  const { error } = await db.from("owner_notifications").delete().eq("id", id)
  return { ok: !error }
}
