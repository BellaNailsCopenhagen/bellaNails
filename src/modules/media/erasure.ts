import "server-only"

import { deleteAsset, listAssetsForMedia } from "@/db/assets"
import { getMediaStorageKey } from "@/db/client-media"
import { deleteGalleryItemsForAsset } from "@/db/gallery-items"
import { deleteObject } from "@/platform/storage/supabase"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"

/**
 * True erasure (GDPR Art. 17): when an image is deleted, destroy the private
 * storage original AND every published public copy (website/social) — a soft
 * archive of the DB row alone would leave the files live. DB cleanup proceeds
 * even if a storage call fails, but **returns `false` if any object could not be
 * deleted**, so a caller can avoid reporting success / deleting the owning row
 * while a file survives. Callers must authorize first — this only purges.
 */
export async function purgeMediaArtifacts(mediaId: string): Promise<boolean> {
  const supabase = createSupabaseServiceRoleClient()
  let clean = true // false if any DB row or storage object failed to delete

  const originalKey = await getMediaStorageKey(supabase, mediaId)

  // Published copies (any purpose): drop the gallery item, the asset row (which
  // cascades its usages), and the public file. Deleting the original will also
  // cascade the asset rows, but we clear the files first so nothing is orphaned.
  const assets = await listAssetsForMedia(supabase, [mediaId])
  for (const asset of assets) {
    const gallery = await deleteGalleryItemsForAsset(supabase, asset.id)
    const assetRow = await deleteAsset(supabase, asset.id)
    if (!gallery.ok || !assetRow.ok) {
      clean = false
    }
    if (asset.storage_key) {
      const res = await deleteObject(asset.storage_key)
      if (!res.ok) {
        clean = false
      }
    }
  }

  // The private original.
  if (originalKey) {
    const res = await deleteObject(originalKey)
    if (!res.ok) {
      clean = false
    }
  }

  return clean
}
