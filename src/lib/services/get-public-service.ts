import type { SupabaseClient } from "@supabase/supabase-js"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/types"
import type { PublicAsset } from "@/lib/services/get-public-assets"

type Client = SupabaseClient<Database>

export type PublicService = {
  id: string
  nameEn: string
  nameDk: string
  descriptionEn: string | null
  descriptionDk: string | null
  basePriceCents: number
  baseDurationMins: number
}

/** One active service by id, for its public detail page (null if missing). */
export async function getPublicService(
  id: string,
  supabase: Client = createSupabaseServerClient(),
): Promise<PublicService | null> {
  const { data } = await supabase
    .from("services")
    .select(
      "id, name_en, name_dk, description_en, description_dk, base_price_cents, base_duration_mins",
    )
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle()
  if (!data) return null
  return {
    id: data.id,
    nameEn: data.name_en,
    nameDk: data.name_dk,
    descriptionEn: data.description_en,
    descriptionDk: data.description_dk,
    basePriceCents: data.base_price_cents,
    baseDurationMins: data.base_duration_mins,
  }
}

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
  supabase: Client = createSupabaseServerClient(),
): Promise<ServiceGallery> {
  const empty: ServiceGallery = { studio: [], clients: [] }

  const { data: media } = await supabase
    .from("client_media")
    .select("id, source")
    .eq("service_id", serviceId)
    .is("archived_at", null)
  if (!media?.length) return empty
  const sourceByMedia = new Map(media.map((m) => [m.id, m.source]))

  const { data: consents } = await supabase
    .from("media_consents")
    .select("client_media_id, published_asset_id")
    .in(
      "client_media_id",
      media.map((m) => m.id),
    )
    .eq("purpose", "site")
    .eq("status", "granted")
    .not("published_asset_id", "is", null)
  if (!consents?.length) return empty

  const sourceByAsset = new Map<string, string>()
  for (const consent of consents) {
    if (!consent.published_asset_id) continue
    const source = sourceByMedia.get(consent.client_media_id)
    if (source) sourceByAsset.set(consent.published_asset_id, source)
  }
  const assetIds = [...sourceByAsset.keys()]
  if (!assetIds.length) return empty

  const { data: assets } = await supabase
    .from("assets")
    .select("id, url, media_type")
    .in("id", assetIds)

  const gallery: ServiceGallery = { studio: [], clients: [] }
  for (const asset of assets ?? []) {
    const item = { id: asset.id, url: asset.url, mediaType: asset.media_type }
    if (sourceByAsset.get(asset.id) === "owner") gallery.studio.push(item)
    else gallery.clients.push(item)
  }
  return gallery
}
