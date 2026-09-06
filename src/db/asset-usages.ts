import type { AssetSurface } from "@/shared/asset-surfaces"

import type { Db, Row } from "./client"
import { firstOf } from "@/platform/supabase/rows"

/** `asset_usages` — where a published asset is placed. One row per
    (asset, surface); the pair is the conflict target for every upsert. */

export type UsageRow = Pick<Row<"asset_usages">, "id" | "asset_id" | "surface" | "url">

export type PlacedAsset = { id: string; url: string; mediaType: string }

/** Assets placed on a public surface, newest first. No consent re-check is
    needed: withdrawing a photo deletes its site usages, so a row here always
    means live consent. */
export async function listAssetsOnSurface(
  db: Db,
  surface: AssetSurface,
  limit?: number,
): Promise<PlacedAsset[]> {
  let query = db
    .from("asset_usages")
    .select("asset:assets(id, url, media_type)")
    .eq("surface", surface)
    .order("created_at", { ascending: false })
  if (limit != null) query = query.limit(limit)

  const { data, error } = await query
  if (error) {
    throw new Error(`Failed to load ${surface} assets: ${error.message}`)
  }

  type Joined = {
    asset:
      | { id: string; url: string; media_type: string }
      | { id: string; url: string; media_type: string }[]
      | null
  }
  return ((data ?? []) as Joined[]).flatMap((row) => {
    const asset = firstOf(row.asset)
    if (!asset?.url) return []
    return [{ id: asset.id, url: asset.url, mediaType: asset.media_type }]
  })
}

/** How many surfaces show this asset. THROWS — the retire guard reads it, and a
    failed count of 0 is indistinguishable from "shown nowhere". */
export async function countUsagesForAsset(
  db: Db,
  assetId: string,
): Promise<number> {
  const { count, error } = await db
    .from("asset_usages")
    .select("id", { count: "exact", head: true })
    .eq("asset_id", assetId)
  if (error) throw new Error(`Failed to count placements: ${error.message}`)
  return count ?? 0
}

export async function listUsagesForAssets(
  db: Db,
  assetIds: string[],
): Promise<UsageRow[]> {
  if (assetIds.length === 0) return []
  const { data } = await db
    .from("asset_usages")
    .select("id, asset_id, surface, url")
    .in("asset_id", assetIds)
  return data ?? []
}

/** Set the post link on a placement that already exists. UPDATE, never upsert:
    an upsert would re-create a placement removed in another tab, putting a photo
    back on a surface the artist had just taken it off. Reports whether a row was
    actually there. */
export async function setUsageLink(
  db: Db,
  assetId: string,
  surface: string,
  url: string | null,
): Promise<{ ok: boolean; found: boolean }> {
  const { data, error } = await db
    .from("asset_usages")
    .update({ url })
    .eq("asset_id", assetId)
    .eq("surface", surface)
    .select("id")
  if (error) return { ok: false, found: false }
  return { ok: true, found: (data ?? []).length > 0 }
}

export async function placeAsset(
  db: Db,
  assetId: string,
  surface: string,
  url: string | null,
): Promise<{ ok: boolean }> {
  const { error } = await db
    .from("asset_usages")
    .upsert({ asset_id: assetId, surface, url }, { onConflict: "asset_id,surface" })
  return { ok: !error }
}

/** Remove one placement, returning the surface it was on (does a public page
    need rebuilding?) and the asset it belonged to (is anything still showing
    that copy?). */
export async function removeUsage(
  db: Db,
  usageId: string,
): Promise<
  { ok: true; surface: string | null; assetId: string | null } | { ok: false }
> {
  const { data, error } = await db
    .from("asset_usages")
    .delete()
    .eq("id", usageId)
    .select("surface, asset_id")
    .maybeSingle()
  if (error) return { ok: false }
  return {
    ok: true,
    surface: data?.surface ?? null,
    assetId: data?.asset_id ?? null,
  }
}
