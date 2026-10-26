import type { Db, Insert, Update } from "./client"
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
    if (!asset?.url) {
      return []
    }

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

/** Every studio gallery item, slotted ones first — the admin manager's list.
    `sort_order` 1-5 are the home-page preview slots; null is gallery-page only. */
export type GalleryItemRow = {
  id: string
  title_en: string | null
  title_dk: string | null
  sort_order: number | null
  primary_asset_id: string | null
  asset_url: string | null
}

export async function listGalleryItems(db: Db): Promise<GalleryItemRow[]> {
  const { data, error } = await db
    .from("gallery_items")
    .select(
      "id, title_en, title_dk, sort_order, primary_asset_id, primary_asset:assets!gallery_items_primary_asset_id_fkey(url)",
    )
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
  if (error) {
    throw new Error(`Failed to load gallery items: ${error.message}`)
  }

  type Raw = Omit<GalleryItemRow, "asset_url"> & {
    primary_asset: { url: string } | { url: string }[] | null
  }

  return ((data ?? []) as Raw[]).map((row) => ({
    id: row.id,
    title_en: row.title_en,
    title_dk: row.title_dk,
    sort_order: row.sort_order,
    primary_asset_id: row.primary_asset_id,
    asset_url: firstOf(row.primary_asset)?.url ?? null,
  }))
}

/** Returns the new row's id so the caller can act on it — claiming a home-page
    position needs to know which row NOT to clear. */
export async function insertGalleryItem(
  db: Db,
  values: Insert<"gallery_items">,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { data, error } = await db
    .from("gallery_items")
    .insert(values)
    .select("id")
    .single()

  return error
    ? { ok: false, message: error.message }
    : { ok: true, id: data.id }
}

export async function updateGalleryItem(
  db: Db,
  id: string,
  values: Update<"gallery_items">,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await db.from("gallery_items").update(values).eq("id", id)

  return error ? { ok: false, message: error.message } : { ok: true }
}

/** The asset a gallery item points at — read before deleting the item, so the
    published file can go with it. */
export async function getGalleryItemAsset(
  db: Db,
  id: string,
): Promise<string | null> {
  const { data } = await db
    .from("gallery_items")
    .select("primary_asset_id")
    .eq("id", id)
    .maybeSingle()

  return data?.primary_asset_id ?? null
}

export async function deleteGalleryItem(
  db: Db,
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await db.from("gallery_items").delete().eq("id", id)

  return error ? { ok: false, message: error.message } : { ok: true }
}

/** Whoever else holds this position loses it. A unique index allows only one
    image per position, so this is what makes reassigning one possible at all;
    pass an empty `exceptId` when the new holder does not exist yet. */
export async function clearGallerySlot(
  db: Db,
  slot: number,
  exceptId: string,
): Promise<{ ok: boolean; displacedId: string | null }> {
  const { data, error } = await db
    .from("gallery_items")
    .update({ sort_order: null })
    .eq("sort_order", slot)
    .neq("id", exceptId || "00000000-0000-0000-0000-000000000000")
    .select("id")
  if (error) {
    return { ok: false, displacedId: null }
  }

  return { ok: true, displacedId: data?.[0]?.id ?? null }
}

/** How many gallery items still show this asset, in either slot — the second
    holder of an `asset_id` that a delete has to answer to.

    Two `.eq` counts rather than one `.or`: the `or` filter is a STRING, so an id
    carrying a comma or a paren rewrites the expression instead of being matched
    by it — and a broken filter counts zero, which is the one answer that lets a
    live photo be deleted. THROWS for the same reason. */
export async function countGalleryItemsUsingAsset(
  db: Db,
  assetId: string,
): Promise<number> {
  const countBy = async (column: "primary_asset_id" | "before_asset_id") => {
    const { count, error } = await db
      .from("gallery_items")
      .select("id", { count: "exact", head: true })
      .eq(column, assetId)
    if (error) {
      throw new Error(`Failed to count gallery items: ${error.message}`)
    }

    return count ?? 0
  }
  const [primary, before] = await Promise.all([
    countBy("primary_asset_id"),
    countBy("before_asset_id"),
  ])

  return primary + before
}
