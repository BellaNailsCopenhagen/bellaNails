import { listAssetUrlsByIds, listWebsiteAssets } from "@/db/assets"
import type { Db } from "@/db/client"
import { listSectionsForService } from "@/db/service-sections"
import { createSupabaseServerClient } from "@/platform/supabase/server"

export type ServiceSection = {
  id: string
  sortOrder: number
  titleEn: string | null
  titleDk: string | null
  bodyEn: string | null
  bodyDk: string | null
  assetId: string | null
  imageUrl: string | null
}

/**
 * A service's content sections, ordered, each with its image URL. Two plain
 * queries (sections, then assets by id) rather than an `assets(url)` embed — a
 * fragile FK embed can error at runtime and silently yield zero sections.
 */
export async function getServiceSections(
  serviceId: string,
  db: Db = createSupabaseServerClient(),
): Promise<ServiceSection[]> {
  const data = await listSectionsForService(db, serviceId)
  if (!data.length) return []

  const assetIds = data
    .map((row) => row.asset_id)
    .filter((id): id is string => Boolean(id))
  const assets = await listAssetUrlsByIds(db, assetIds)
  const urlById = new Map(assets.map((a) => [a.id, a.url]))

  return data.map((row) => ({
    id: row.id,
    sortOrder: row.sort_order,
    titleEn: row.title_en,
    titleDk: row.title_dk,
    bodyEn: row.body_en,
    bodyDk: row.body_dk,
    assetId: row.asset_id,
    imageUrl: row.asset_id ? (urlById.get(row.asset_id) ?? null) : null,
  }))
}

export type PickableAsset = { id: string; url: string }

/**
 * The pool the image picker offers under "use one from the shared gallery":
 * public copies published ON THE WEBSITE (purpose = website). A social-only copy
 * must NOT be pickable here — section images render on the public site.
 */
export async function getConsentedAssets(
  db: Db = createSupabaseServerClient(),
): Promise<PickableAsset[]> {
  const assets = await listWebsiteAssets(db)
  return assets.map((a) => ({ id: a.id, url: a.url }))
}
