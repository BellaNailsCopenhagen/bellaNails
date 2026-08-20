import "server-only"

import { deleteObject } from "@/lib/storage/scaleway"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

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

  const { data: media } = await supabase
    .from("client_media")
    .select("storage_key")
    .eq("id", mediaId)
    .maybeSingle()

  // Published copies: drop the gallery item, the asset row, and the public file.
  const { data: consents } = await supabase
    .from("media_consents")
    .select("id, published_asset_id")
    .eq("client_media_id", mediaId)
    .not("published_asset_id", "is", null)

  for (const consent of consents ?? []) {
    if (!consent.published_asset_id) continue
    const { data: asset } = await supabase
      .from("assets")
      .select("storage_key")
      .eq("id", consent.published_asset_id)
      .maybeSingle()
    const gallery = await supabase
      .from("gallery_items")
      .delete()
      .eq("primary_asset_id", consent.published_asset_id)
    const assetRow = await supabase
      .from("assets")
      .delete()
      .eq("id", consent.published_asset_id)
    const pointer = await supabase
      .from("media_consents")
      .update({ published_asset_id: null })
      .eq("id", consent.id)
    if (gallery.error || assetRow.error || pointer.error) clean = false
    if (asset?.storage_key) {
      const res = await deleteObject(asset.storage_key)
      if (!res.ok) clean = false
    }
  }

  // The private original.
  if (media?.storage_key) {
    const res = await deleteObject(media.storage_key)
    if (!res.ok) clean = false
  }
  return clean
}
