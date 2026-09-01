import type { Db, Insert, Row } from "./client"

/** `design_messages` — the append-only conversation on one design request. The
    client's opening message is row one; the artist's replies follow. */

export type DesignMessageRow = Row<"design_messages">

export async function insertDesignMessage(
  db: Db,
  values: Insert<"design_messages">,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { data, error } = await db
    .from("design_messages")
    .insert(values)
    .select("id")
    .single()
  if (error || !data) return { ok: false, message: error?.message ?? "no row" }
  return { ok: true, id: data.id }
}

/** One thread, oldest first — the order it is read in. */
export async function listDesignMessages(
  db: Db,
  requestId: string,
): Promise<DesignMessageRow[]> {
  const { data } = await db
    .from("design_messages")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true })
  return data ?? []
}

/** Every thread for a set of requests, so the admin queue renders N cards
    without N queries. The caller groups by `request_id`. */
export async function listDesignMessagesForRequests(
  db: Db,
  requestIds: string[],
): Promise<DesignMessageRow[]> {
  if (!requestIds.length) return []
  const { data } = await db
    .from("design_messages")
    .select("*")
    .in("request_id", requestIds)
    .order("created_at", { ascending: true })
  return data ?? []
}
