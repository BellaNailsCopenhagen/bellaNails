import type { Db } from "@/db/client"
import {
  listGalleryPreviewItems,
  type GalleryPreviewItem,
} from "@/db/gallery-items"
import { createSupabaseServerClient } from "@/platform/supabase/server"

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
