import "server-only"

import { deleteAsset, getAssetStorageKey } from "@/db/assets"
import { getMediaStorageKey } from "@/db/client-media"
import { deleteGalleryItemsForAsset } from "@/db/gallery-items"
import {
  clearPublishedAsset,
  listPublishedConsentsFor,
} from "@/db/media-consents"
import { deleteObject } from "@/platform/storage/scaleway"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"

/**
 * True erasure (GDPR Art. 17): when an image is deleted, destroy the private
 * storage original AND every published public copy (site/SoMe) — a soft archive
 * of the DB row alone would leave the files live. DB cleanup proceeds even if a
 * storage call fails, but **returns `false` if any object could not be
 * deleted**, so a caller can avoid reporting success / deleting the owning row
 * while a file survives. Callers must authorize first — this only purges.
 */
export async function purgeMediaArtifacts(mediaId: string): Promise<boolean> {
  const supabase = createSupabaseServiceRoleClient()
  let clean = true // false if any DB row or storage object failed to delete

  const originalKey = await getMediaStorageKey(supabase, mediaId)

  // Published copies: drop the gallery item, the asset row, and the public file.
  const consents = await listPublishedConsentsFor(supabase, mediaId)

  for (const consent of consents) {
    const assetId = consent.published_asset_id
    if (!assetId) continue
    const assetKey = await getAssetStorageKey(supabase, assetId)
    const gallery = await deleteGalleryItemsForAsset(supabase, assetId)
    const assetRow = await deleteAsset(supabase, assetId)
    const pointer = await clearPublishedAsset(supabase, consent.id)
    if (!gallery.ok || !assetRow.ok || !pointer.ok) clean = false
    if (assetKey) {
      const res = await deleteObject(assetKey)
      if (!res.ok) clean = false
    }
  }

  // The private original.
  if (originalKey) {
    const res = await deleteObject(originalKey)
    if (!res.ok) clean = false
  }
  return clean
}
