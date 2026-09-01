import type { Db, Insert, Row, Update } from "./client"

/** `design_requests` — a client's async ask ("can you do this?", "my nail
    broke"). Holds no time and books nothing; the artist answers with an offer.
    Service-role writes; RLS lets the owner read all and a client read their own. */

export type DesignRequestRow = Row<"design_requests">

/** Statuses the admin queue still has to act on. */
const ACTIONABLE = ["open", "offered"] as const

export async function insertDesignRequest(
  db: Db,
  values: Insert<"design_requests">,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { data, error } = await db
    .from("design_requests")
    .insert(values)
    .select("id")
    .single()
  if (error || !data) return { ok: false, message: error?.message ?? "no row" }
  return { ok: true, id: data.id }
}

/** The admin queue, oldest first — act on the person who has waited longest. */
export async function listActionableDesignRequests(
  db: Db,
): Promise<DesignRequestRow[]> {
  const { data } = await db
    .from("design_requests")
    .select("*")
    .in("status", ACTIONABLE)
    .order("created_at", { ascending: true })
  return data ?? []
}

export async function countActionableDesignRequests(db: Db): Promise<number> {
  const { count } = await db
    .from("design_requests")
    .select("id", { count: "exact", head: true })
    .in("status", ACTIONABLE)
  return count ?? 0
}

export async function getDesignRequest(
  db: Db,
  id: string,
): Promise<DesignRequestRow | null> {
  const { data } = await db
    .from("design_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  return data ?? null
}

export async function updateDesignRequest(
  db: Db,
  id: string,
  values: Update<"design_requests">,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await db.from("design_requests").update(values).eq("id", id)
  return error ? { ok: false, message: error.message } : { ok: true }
}

/** A client's own requests — My Space, and the DSAR export. */
export async function listDesignRequestsForClient(
  db: Db,
  clientId: string,
): Promise<DesignRequestRow[]> {
  const { data } = await db
    .from("design_requests")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
  return data ?? []
}

/** How many requests a client already has open — the abuse cap reads this. */
export async function countActionableDesignRequestsForClient(
  db: Db,
  clientId: string,
): Promise<number> {
  const { count } = await db
    .from("design_requests")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .in("status", ACTIONABLE)
  return count ?? 0
}

/** Roll back a request whose opening message failed to save — a request with an
    empty thread is a dead card in the queue. */
export async function deleteDesignRequest(
  db: Db,
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await db.from("design_requests").delete().eq("id", id)
  return error ? { ok: false, message: error.message } : { ok: true }
}

/** GDPR erasure — the message thread is client free-text (PII) and a request is
    ephemeral, so delete outright. Messages, refs and offers cascade. */
export async function deleteDesignRequestsForClient(
  db: Db,
  clientId: string,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await db
    .from("design_requests")
    .delete()
    .eq("client_id", clientId)
  return error ? { ok: false, message: error.message } : { ok: true }
}
