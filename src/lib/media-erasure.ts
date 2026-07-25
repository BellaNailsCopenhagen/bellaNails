import "server-only"

import { deleteObject } from "@/lib/storage/scaleway"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * True erasure (GDPR Art. 17): when an image is deleted, destroy the private
 * storage original AND every published public copy (site/SoMe) — a soft
 * archive of the DB row alone would leave the files live. Best-effort per file:
 * DB cleanup proceeds even if a storage call fails, so a removed image never
 * keeps pointing at a live asset. Callers must authorize first — this only purges.
 */
export async function purgeMediaArtifacts(mediaId: string): Promise<void> {
  const supabase = createSupabaseServiceRoleClient()

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
    await supabase
      .from("gallery_items")
      .delete()
      .eq("primary_asset_id", consent.published_asset_id)
    await supabase.from("assets").delete().eq("id", consent.published_asset_id)
    await supabase
      .from("media_consents")
      .update({ published_asset_id: null })
      .eq("id", consent.id)
    if (asset?.storage_key) await deleteObject(asset.storage_key)
  }

  // The private original.
  if (media?.storage_key) await deleteObject(media.storage_key)
}
