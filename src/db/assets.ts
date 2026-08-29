import type { Db, Row } from "./client"

/** `assets` — a published, public-readable copy of ONE client_media item,
    authorized under a granted `media_releases` row. `purpose` records which
    release cleared it (website / social); `client_media_id` ties it to the
    original so takedown + erasure key off the source. Deleting an asset cascades
    its `asset_usages` (but NOT `gallery_items` — clear those first). */

export type PublicAssetRow = Pick<Row<"assets">, "id" | "url" | "media_type">

/** Asset + the original it came from — the service gallery maps back to source. */
export type MediaAssetRow = Pick<
  Row<"assets">,
  "id" | "url" | "media_type" | "client_media_id" | "purpose"
>

/** Asset + its lifecycle fields — the admin hub state + takedown flows. */
export type AssetInfoRow = Pick<
  Row<"assets">,
  "id" | "client_media_id" | "purpose" | "storage_key" | "needs_takedown_at"
>

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

/** Every website-published copy (id + url) — the section image-picker pool. */
export async function listWebsiteAssets(
  db: Db,
): Promise<Pick<Row<"assets">, "id" | "url">[]> {
  const { data } = await db
    .from("assets")
    .select("id, url")
    .eq("purpose", "website")
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

/** Website-published copies of a set of originals — the public service gallery
    (an asset existing FOR website means the booking's release is live; withdrawal
    deletes it, so no separate consent re-check is needed). */
export async function listWebsiteAssetsForMedia(
  db: Db,
  mediaIds: string[],
): Promise<MediaAssetRow[]> {
  const ids = [...new Set(mediaIds.filter(Boolean))]
  if (ids.length === 0) return []
  const { data } = await db
    .from("assets")
    .select("id, url, media_type, client_media_id, purpose")
    .eq("purpose", "website")
    .in("client_media_id", ids)
  return data ?? []
}

/** Published copies of a set of originals for one purpose — the withdrawal
    target set (delete website copies / flag social copies for takedown). */
export async function listAssetsForMediaByPurpose(
  db: Db,
  mediaIds: string[],
  purpose: "website" | "social",
): Promise<AssetInfoRow[]> {
  const ids = [...new Set(mediaIds.filter(Boolean))]
  if (ids.length === 0) return []
  const { data } = await db
    .from("assets")
    .select("id, client_media_id, purpose, storage_key, needs_takedown_at")
    .eq("purpose", purpose)
    .in("client_media_id", ids)
  return data ?? []
}

/** Every published copy of a set of originals — the admin hub read model. */
export async function listAssetsForMedia(
  db: Db,
  mediaIds: string[],
): Promise<AssetInfoRow[]> {
  const ids = [...new Set(mediaIds.filter(Boolean))]
  if (ids.length === 0) return []
  const { data } = await db
    .from("assets")
    .select("id, client_media_id, purpose, storage_key, needs_takedown_at")
    .in("client_media_id", ids)
  return data ?? []
}

/** Does this original have ANY published copy? — the erasure "keep" signal (a
    shared/published image survives; the client's lever is withdrawal). */
export async function hasPublishedAssetForMedia(
  db: Db,
  mediaId: string,
): Promise<boolean> {
  const { data } = await db
    .from("assets")
    .select("id")
    .eq("client_media_id", mediaId)
    .limit(1)
  return Boolean(data?.length)
}

/** The purpose (website/social) a published copy was authorized for — the
    placement scope guard. */
export async function getAssetPurpose(
  db: Db,
  id: string,
): Promise<string | null> {
  const { data } = await db
    .from("assets")
    .select("purpose")
    .eq("id", id)
    .maybeSingle()
  return data?.purpose ?? null
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
  values: {
    url: string
    media_type: string
    storage_key: string
    // Set for a published copy of a client_media (a release publish); omitted for
    // a directly-uploaded asset like a service-section image.
    client_media_id?: string
    purpose?: "website" | "social"
  },
): Promise<{ ok: true; id: string } | { ok: false }> {
  const { data, error } = await db
    .from("assets")
    .insert(values)
    .select("id")
    .single()
  if (error || !data) return { ok: false }
  return { ok: true, id: data.id }
}

/** Flag social copies for manual takedown (the external post can't be auto-
    deleted on withdrawal — the studio removes it, then confirms). */
export async function flagAssetsTakedown(
  db: Db,
  ids: string[],
  atIso: string,
): Promise<{ ok: boolean }> {
  if (ids.length === 0) return { ok: true }
  const { error } = await db
    .from("assets")
    .update({ needs_takedown_at: atIso })
    .in("id", ids)
  return { ok: !error }
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
