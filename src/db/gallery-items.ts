import type { Db } from "./client"
import { firstOf } from "@/platform/supabase/rows"

/** `gallery_items` — the curated studio gallery. `sort_order` 1–5 marks the
    home-page preview slots; unslotted items are gallery-page only. */

export type GalleryPreviewItem = {
  id: string
  title_en: string | null
  title_dk: string | null
  asset_url: string
}

/** The slotted preview items for the home-page Studio section, in slot order. */
export async function listGalleryPreviewItems(
  db: Db,
  limit: number,
): Promise<GalleryPreviewItem[]> {
  const { data, error } = await db
    .from("gallery_items")
    .select(
      "id, title_en, title_dk, primary_asset:assets!gallery_items_primary_asset_id_fkey(url)",
    )
    .not("sort_order", "is", null)
    .order("sort_order", { ascending: true })
    .limit(limit)
  if (error) {
    throw new Error(`Failed to load gallery preview items: ${error.message}`)
  }

  type Raw = {
    id: string
    title_en: string | null
    title_dk: string | null
    primary_asset: { url: string } | { url: string }[] | null
  }
  return ((data ?? []) as Raw[]).flatMap((row) => {
    const asset = firstOf(row.primary_asset)
    if (!asset?.url) return []
    return [
      {
        id: row.id,
        title_en: row.title_en,
        title_dk: row.title_dk,
        asset_url: asset.url,
      },
    ]
  })
}

/** Unpublish every gallery item built on an asset — must run before the asset
    row is deleted (this FK does not cascade). */
export async function deleteGalleryItemsForAsset(
  db: Db,
  assetId: string,
): Promise<{ ok: boolean }> {
  const { error } = await db
    .from("gallery_items")
    .delete()
    .eq("primary_asset_id", assetId)
  return { ok: !error }
}
