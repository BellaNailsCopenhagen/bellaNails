import { listAssetUrlsByIds } from "@/db/assets"
import type { Db } from "@/db/client"
import { listGrantedSiteAssetIds } from "@/db/media-consents"
import { listSectionsForService } from "@/db/service-sections"

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
  db: Db,
  serviceId: string,
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
 * public copies the client consented to publish ON THE WEBSITE (purpose = site).
 * A social-only consent must NOT be pickable here — section images render on the
 * public site. Two plain queries (consents → asset ids → assets) since the FK
 * isn't in the hand-maintained types. Deduplicated across any duplicate rows.
 */
export async function getConsentedAssets(db: Db): Promise<PickableAsset[]> {
  const ids = await listGrantedSiteAssetIds(db)
  if (!ids.length) return []
  const assets = await listAssetUrlsByIds(db, ids)
  return assets.map((a) => ({ id: a.id, url: a.url }))
}
