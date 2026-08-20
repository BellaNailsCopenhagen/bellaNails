import type { Db, Row } from "./client"

/** `assets` — a published, public-readable copy of an image. Created when
    consent is granted; deleting one cascades its `asset_usages`. */

export type PublicAssetRow = Pick<Row<"assets">, "id" | "url" | "media_type">

export async function listAssetsByIds(
  db: Db,
  ids: string[],
): Promise<PublicAssetRow[]> {
  if (ids.length === 0) return []
  const { data } = await db
    .from("assets")
    .select("id, url, media_type")
    .in("id", ids)
  return data ?? []
}

/** Id + url only — the service-section image resolver. */
export async function listAssetUrlsByIds(
  db: Db,
  ids: string[],
): Promise<Pick<Row<"assets">, "id" | "url">[]> {
  if (ids.length === 0) return []
  const { data } = await db.from("assets").select("id, url").in("id", ids)
  return data ?? []
}

/** The storage key behind an asset — needed to delete the public object. */
export async function getAssetStorageKey(
  db: Db,
  id: string,
): Promise<string | null> {
  const { data } = await db
    .from("assets")
    .select("storage_key")
    .eq("id", id)
    .maybeSingle()
  return data?.storage_key ?? null
}

export async function insertAsset(
  db: Db,
  values: { url: string; media_type: string; storage_key: string },
): Promise<{ ok: true; id: string } | { ok: false }> {
  const { data, error } = await db
    .from("assets")
    .insert(values)
    .select("id")
    .single()
  if (error || !data) return { ok: false }
  return { ok: true, id: data.id }
}

/** Delete the asset row. Its `asset_usages` cascade; `gallery_items` do not —
    clear those first. */
export async function deleteAsset(
  db: Db,
  id: string,
): Promise<{ ok: boolean }> {
  const { error } = await db.from("assets").delete().eq("id", id)
  return { ok: !error }
}
