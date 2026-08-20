import { listAssetsByIds } from "@/db/assets"
import type { Db } from "@/db/client"
import { listMediaForService } from "@/db/client-media"
import { listGrantedSitePublications } from "@/db/media-consents"
import { createSupabaseServerClient } from "@/platform/supabase/server"

export type PublicAsset = { id: string; url: string; mediaType: string }
export type ServiceGallery = { studio: PublicAsset[]; clients: PublicAsset[] }

/**
 * A service's real-work photos for the public page, split by who made them:
 * `studio` (source = owner) and `clients` (source = client). Only photos the
 * client consented to publish on the WEBSITE (purpose = site) appear — a
 * social-only consent doesn't belong on the site. Linked via bookings, which
 * inherit onto client_media.service_id.
 */
export async function getServicePublicGallery(
  serviceId: string,
  db: Db = createSupabaseServerClient(),
): Promise<ServiceGallery> {
  const empty: ServiceGallery = { studio: [], clients: [] }

  const media = await listMediaForService(db, serviceId)
  if (!media.length) return empty
  const sourceByMedia = new Map(media.map((m) => [m.id, m.source]))

  const consents = await listGrantedSitePublications(
    db,
    media.map((m) => m.id),
  )
  if (!consents.length) return empty

  const sourceByAsset = new Map<string, string>()
  for (const consent of consents) {
    const source = sourceByMedia.get(consent.client_media_id)
    if (source) sourceByAsset.set(consent.published_asset_id, source)
  }
  const assetIds = [...sourceByAsset.keys()]
  if (!assetIds.length) return empty

  const assets = await listAssetsByIds(db, assetIds)
  const gallery: ServiceGallery = { studio: [], clients: [] }
  for (const asset of assets) {
    const item = { id: asset.id, url: asset.url, mediaType: asset.media_type }
    if (sourceByAsset.get(asset.id) === "owner") gallery.studio.push(item)
    else gallery.clients.push(item)
  }
  return gallery
}
