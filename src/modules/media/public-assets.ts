import { listAssetsOnSurface, type PlacedAsset } from "@/db/asset-usages"
import type { Db } from "@/db/client"
import { createSupabaseServerClient } from "@/platform/supabase/server"
import type { AssetSurface } from "@/shared/asset-surfaces"

export type PublicAsset = PlacedAsset

/**
 * Client photos placed on a public surface (clients_gallery / showcase /
 * testimonial), newest first. No consent re-check is needed: withdrawing a
 * photo deletes its site usages (consent-actions.ts), so a row here always
 * means live consent.
 */
export async function getPublicAssetsBySurface(
  surface: AssetSurface,
  limit?: number,
  db: Db = createSupabaseServerClient(),
): Promise<PublicAsset[]> {
  return listAssetsOnSurface(db, surface, limit)
}
