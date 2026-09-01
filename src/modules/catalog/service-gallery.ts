import { listWebsiteAssetsForMedia } from "@/db/assets"
import type { Db } from "@/db/client"
import { listMediaForService } from "@/db/client-media"
import { createSupabaseServerClient } from "@/platform/supabase/server"

export type PublicAsset = { id: string; url: string; mediaType: string }
export type ServiceGallery = PublicAsset[]

/**
 * A service's real-work photos/videos for the public page. Only media published
 * for the WEBSITE appears (a published `assets` row for purpose=website means
 * the booking's release is live; withdrawal deletes it, so no separate consent
 * re-check is needed). Linked via bookings, which inherit onto
 * client_media.service_id.
 *
 * No longer split by who shot it: clients don't upload, so every one of these is
 * the artist's own photo of the work.
 */
export async function getServicePublicGallery(
  serviceId: string,
  db: Db = createSupabaseServerClient(),
): Promise<ServiceGallery> {
  const media = await listMediaForService(db, serviceId)
  if (!media.length) return []

  const assets = await listWebsiteAssetsForMedia(
    db,
    media.map((m) => m.id),
  )

  return assets.map((asset) => ({
    id: asset.id,
    url: asset.url,
    mediaType: asset.media_type,
  }))
}
