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

export async function listSurfacesForAsset(
  db: Db,
  assetId: string,
): Promise<string[]> {
  const { data } = await db
    .from("asset_usages")
    .select("surface")
    .eq("asset_id", assetId)
  return (data ?? []).map((u) => u.surface)
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

/** Remove one placement, returning the surface it was on so the caller knows
    whether a public surface needs revalidating. */
export async function removeUsage(
  db: Db,
  usageId: string,
): Promise<{ ok: true; surface: string | null } | { ok: false }> {
  const { data, error } = await db
    .from("asset_usages")
    .delete()
    .eq("id", usageId)
    .select("surface")
    .maybeSingle()
  if (error) return { ok: false }
  return { ok: true, surface: data?.surface ?? null }
}

/** Drop every placement of an asset except one surface — used when social
    consent survives a site withdrawal. */
export async function removeUsagesExceptSurface(
  db: Db,
  assetId: string,
  keepSurface: string,
): Promise<{ ok: boolean }> {
  const { error } = await db
    .from("asset_usages")
    .delete()
    .eq("asset_id", assetId)
    .neq("surface", keepSurface)
  return { ok: !error }
}
