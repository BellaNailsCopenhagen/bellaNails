import { listWebsiteAssetsForMedia } from "@/db/assets"
import type { Db } from "@/db/client"
import { listMediaForService } from "@/db/client-media"
import { createSupabaseServerClient } from "@/platform/supabase/server"

export type PublicAsset = { id: string; url: string; mediaType: string }
export type ServiceGallery = { studio: PublicAsset[]; clients: PublicAsset[] }

/**
 * A service's real-work photos/videos for the public page, split by who made
 * them: `studio` (source = owner) and `clients` (source = client). Only media
 * published for the WEBSITE appears (a published `assets` row for purpose=website
 * means the booking's release is live; withdrawal deletes it, so no separate
 * consent re-check is needed). Linked via bookings, which inherit onto
 * client_media.service_id.
 */
export async function getServicePublicGallery(
  serviceId: string,
  db: Db = createSupabaseServerClient(),
): Promise<ServiceGallery> {
  const empty: ServiceGallery = { studio: [], clients: [] }

  const media = await listMediaForService(db, serviceId)
  if (!media.length) return empty
  const sourceByMedia = new Map(media.map((m) => [m.id, m.source]))

  const assets = await listWebsiteAssetsForMedia(
    db,
    media.map((m) => m.id),
  )
  if (!assets.length) return empty

  const gallery: ServiceGallery = { studio: [], clients: [] }
  for (const asset of assets) {
    const item = { id: asset.id, url: asset.url, mediaType: asset.media_type }
    const source = asset.client_media_id
      ? sourceByMedia.get(asset.client_media_id)
      : undefined
    if (source === "owner") gallery.studio.push(item)
    else gallery.clients.push(item)
  }
  return gallery
}
