import type { Db, Insert, Row } from "./client"

/** `design_refs` — reference photos on a design request. Kept apart from
    `client_media` on purpose: these are usually someone else's copyrighted work,
    they must be structurally unable to reach the publish pipeline, and they
    carry their own short retention (`purge_after`). */

export type DesignRefRow = Row<"design_refs">

export async function insertDesignRefs(
  db: Db,
  values: Insert<"design_refs">[],
): Promise<{ ok: boolean; message?: string }> {
  if (!values.length) {
    return { ok: true }
  }
  const { error } = await db.from("design_refs").insert(values)

  return error ? { ok: false, message: error.message } : { ok: true }
}

export async function listDesignRefs(
  db: Db,
  requestId: string,
): Promise<DesignRefRow[]> {
  const { data } = await db
    .from("design_refs")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true })

  return data ?? []
}

/** Refs for a set of requests, so the admin queue renders N cards in one query. */
export async function listDesignRefsForRequests(
  db: Db,
  requestIds: string[],
): Promise<DesignRefRow[]> {
  if (!requestIds.length) {
    return []
  }
  const { data } = await db
    .from("design_refs")
    .select("*")
    .in("request_id", requestIds)
    .order("created_at", { ascending: true })

  return data ?? []
}

/** How many photos a request already carries — the per-request cap reads this. */
export async function countDesignRefs(
  db: Db,
  requestId: string,
): Promise<number> {
  const { count } = await db
    .from("design_refs")
    .select("id", { count: "exact", head: true })
    .eq("request_id", requestId)

  return count ?? 0
}

/** Which of these keys are actually attached to a request — the orphan sweep
    asks this before deleting anything it found in the bucket. */
export async function listDesignRefKeys(
  db: Db,
  storageKeys: string[],
): Promise<Set<string>> {
  if (!storageKeys.length) {
    return new Set()
  }
  const { data } = await db
    .from("design_refs")
    .select("storage_key")
    .in("storage_key", storageKeys)

  return new Set((data ?? []).map((row) => row.storage_key))
}

/**
 * The row for one storage key, if any — and whether the question could be
 * answered at all. Distinguishing "no row" from "the query failed" is the whole
 * point: a discard that reads a failure as "unattached" deletes an object the
 * thread is still rendering.
 */
export async function findDesignRefByKey(
  db: Db,
  storageKey: string,
): Promise<{ ok: true; row: DesignRefRow | null } | { ok: false }> {
  const { data, error } = await db
    .from("design_refs")
    .select("*")
    .eq("storage_key", storageKey)
    .maybeSingle()
  if (error) {
    return { ok: false }
  }

  return { ok: true, row: data ?? null }
}

/** Everything a client owns — erasure needs the storage keys before deleting. */
export async function listDesignRefsForClient(
  db: Db,
  clientId: string,
): Promise<DesignRefRow[]> {
  const { data } = await db
    .from("design_refs")
    .select("*")
    .eq("client_id", clientId)

  return data ?? []
}

/** Rows past their retention — the purge sweep reads keys, then deletes. */
export async function listDesignRefsToPurge(
  db: Db,
  nowIso: string,
  limit: number,
): Promise<DesignRefRow[]> {
  const { data } = await db
    .from("design_refs")
    .select("*")
    .lt("purge_after", nowIso)
    .limit(limit)

  return data ?? []
}

export async function deleteDesignRefs(
  db: Db,
  ids: string[],
): Promise<{ ok: boolean; message?: string }> {
  if (!ids.length) {
    return { ok: true }
  }
  const { error } = await db.from("design_refs").delete().in("id", ids)

  return error ? { ok: false, message: error.message } : { ok: true }
}
