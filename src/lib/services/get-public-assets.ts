import type { SupabaseClient } from "@supabase/supabase-js"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/types"
import type { AssetSurface } from "@/lib/asset-surfaces"
import { firstOf } from "@/lib/utils"

export type PublicAsset = { id: string; url: string; mediaType: string }

// PostgREST types a FK embed as the row or an array of them; normalized below.
type PublicAssetRow = {
  asset:
    | { id: string; url: string; media_type: string }
    | { id: string; url: string; media_type: string }[]
    | null
}

/**
 * Client photos placed on a public surface (clients_gallery / showcase /
 * testimonial), newest first. Reads `asset_usages` → `assets`; both are
 * public-read. No consent re-check is needed: withdrawing a photo deletes its
 * site usages (client-consent.ts), so a row here always means live consent.
 *
 * Anon server client by default (standard RSC read); an existing client can be
 * injected to share one instance across reads — positional, matching
 * getGalleryPreviewItems in this directory.
 */
export async function getPublicAssetsBySurface(
  surface: AssetSurface,
  limit?: number,
  supabase: SupabaseClient<Database> = createSupabaseServerClient(),
): Promise<PublicAsset[]> {
  let query = supabase
    .from("asset_usages")
    .select("asset:assets(id, url, media_type)")
    .eq("surface", surface)
    .order("created_at", { ascending: false })
  if (limit != null) query = query.limit(limit)

  const { data, error } = await query
  if (error) {
    throw new Error(`Failed to load ${surface} assets: ${error.message}`)
  }

  return ((data ?? []) as PublicAssetRow[]).flatMap((row) => {
    const asset = firstOf(row.asset)
    if (!asset?.url) return []
    return [{ id: asset.id, url: asset.url, mediaType: asset.media_type }]
  })
}
