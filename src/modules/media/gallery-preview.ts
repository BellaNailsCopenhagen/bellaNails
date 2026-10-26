import type { Db } from "@/db/client"
import {
  listGalleryItems,
  listGalleryPreviewItems,
  type GalleryItemRow,
  type GalleryPreviewItem,
} from "@/db/gallery-items"
import { createSupabaseServerClient } from "@/platform/supabase/server"
import { requireOwner } from "@/modules/identity/require-owner"

/** How many home-page Studio slots exist (sort_order 1–5). */
const PREVIEW_SLOTS = 5

/**
 * Featured gallery items for the home-page Studio section, ordered by their
 * `sort_order` slot. Only items assigned a slot are returned.
 *
 * Defaults to the anon server client (the standard RSC pattern) but accepts an
 * injected client so a request can reuse one instance across several reads.
 */
export async function getGalleryPreviewItems(
  db: Db = createSupabaseServerClient(),
): Promise<GalleryPreviewItem[]> {
  return listGalleryPreviewItems(db, PREVIEW_SLOTS)
}

export type { GalleryPreviewItem }

/**
 * Every studio gallery image, for the admin manager — featured ones first.
 * Service-role: the manager is owner-gated by the proxy, and it must see items
 * whose asset row has gone missing so they can be removed.
 *
 * `loadError` is not decoration: an empty list means "add your first image", and
 * showing that after a failed read invites the artist to upload her whole
 * portfolio a second time.
 */
export async function getStudioGalleryItems(): Promise<{
  items: StudioGalleryImage[]
  loadError: boolean
}> {
  try {
    const db = await requireOwner()
    if (!db) {
      return { items: [], loadError: false }
    }
    const rows = await listGalleryItems(db)

    return { items: rows.map(toStudioGalleryImage), loadError: false }
  } catch (error) {
    console.error("[studio-gallery] read failed", error)

    return { items: [], loadError: true }
  }
}

/** One studio image as the admin renders it. The db row is schema-shaped
    (`title_dk`, `sort_order`); the UI should not have to know that, and did not
    even agree with it — the editor already called the field `titleDa`. */
export type StudioGalleryImage = {
  id: string
  assetId: string | null
  imageUrl: string | null
  captionEn: string
  captionDa: string
  /** A home-page position, or null for gallery-page only. */
  slot: number | null
}

function toStudioGalleryImage(row: GalleryItemRow): StudioGalleryImage {
  return {
    id: row.id,
    assetId: row.primary_asset_id,
    imageUrl: row.asset_url,
    captionEn: row.title_en ?? "",
    captionDa: row.title_dk ?? "",
    slot: row.sort_order,
  }
}
