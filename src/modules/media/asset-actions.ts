"use server"

import { revalidatePath } from "next/cache"

import { placeAsset } from "@/db/asset-usages"
import { deleteAsset, getAssetStorageKey } from "@/db/assets"
import {
  listMediaOwners,
  setMediaDismissed as setMediaDismissedAt,
  setMediaFavorited as setMediaFavoritedAt,
} from "@/db/client-media"
import { deleteGalleryItemsForAsset } from "@/db/gallery-items"
import {
  getPublishedAssetId,
  listSiteConsentsFor,
  updateConsent,
  upsertConsent,
} from "@/db/media-consents"
import { requireOwner } from "@/modules/identity/require-owner"
import { revalidatePublicSurfaces } from "@/modules/media/revalidate-surfaces"
import { deleteObject } from "@/platform/storage/scaleway"
import { routes } from "@/shared/routes"

export type AssetHubResult = { ok: true } | { ok: false; error: string }

/**
 * Bulk "add to website gallery" — one flow: a photo the client already consented
 * to (site) is placed on the clients_gallery surface right away; one that hasn't
 * gets a site consent request flagged to AUTO-PLACE the moment it's granted
 * (grantMediaConsentRow honours the flag). No per-item confirmation.
 */
export async function bulkAddToGallery(
  mediaIds: string[],
): Promise<AssetHubResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }
  if (!mediaIds.length) return { ok: true }

  const media = await listMediaOwners(supabase, mediaIds)
  const ownerByMedia = new Map(media.map((m) => [m.id, m.client_id]))

  const consents = await listSiteConsentsFor(supabase, mediaIds)
  const siteByMedia = new Map(consents.map((c) => [c.client_media_id, c]))

  for (const mediaId of mediaIds) {
    const consent = siteByMedia.get(mediaId)
    // Already granted → place the published copy; never re-ask (an unpublished
    // grant is a storage-retry, not a reason to reset the client's yes).
    if (consent?.status === "granted") {
      if (consent.published_asset_id) {
        await placeAsset(
          supabase,
          consent.published_asset_id,
          "clients_gallery",
          null,
        )
      }
      continue
    }
    const clientId = ownerByMedia.get(mediaId)
    if (!clientId) continue
    const base = {
      client_media_id: mediaId,
      client_id: clientId,
      purpose: "site",
      status: "requested",
      requested_at: new Date().toISOString(),
      granted_at: null,
      declined_at: null,
      withdrawn_at: null,
      needs_takedown_at: null,
      published_asset_id: null,
    }
    await upsertConsent(supabase, { ...base, auto_place: true })
  }

  revalidatePath(routes.admin.assets)
  revalidatePublicSurfaces()
  return { ok: true }
}

/**
 * The artist confirms a withdrawn-but-live asset has been taken down (the manual
 * social removal) — now erase the kept published copy for real. Clears the
 * takedown flag so it leaves the "Used & withdrawn" tab.
 */
export async function confirmTakedown(
  consentId: string,
): Promise<AssetHubResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const consent = await getPublishedAssetId(supabase, consentId)
  if (!consent.found) return { ok: false, error: "not_found" }

  if (consent.assetId) {
    const storageKey = await getAssetStorageKey(supabase, consent.assetId)
    await deleteGalleryItemsForAsset(supabase, consent.assetId)
    // Deleting the asset cascades its asset_usages.
    await deleteAsset(supabase, consent.assetId)
    if (storageKey) await deleteObject(storageKey)
  }

  await updateConsent(supabase, consentId, {
    published_asset_id: null,
    needs_takedown_at: null,
  })

  revalidatePath(routes.admin.assets)
  return { ok: true }
}

/** Heart (or un-heart) a photo — the artist's curation shortlist, available in
    any state, independent of consent. */
export async function setMediaFavorite(
  mediaId: string,
  favorite: boolean,
): Promise<AssetHubResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const saved = await setMediaFavoritedAt(
    supabase,
    mediaId,
    favorite ? new Date().toISOString() : null,
  )
  if (!saved.ok) return { ok: false, error: "Couldn’t update." }

  revalidatePath(routes.admin.assets)
  return { ok: true }
}

/** Set aside (or restore) a client upload without deleting it — keeps the New
    tab to real pending work. The client's photo is untouched. */
export async function setMediaDismissed(
  mediaId: string,
  dismissed: boolean,
): Promise<AssetHubResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const saved = await setMediaDismissedAt(
    supabase,
    mediaId,
    dismissed ? new Date().toISOString() : null,
  )
  if (!saved.ok) return { ok: false, error: "Couldn’t update." }

  revalidatePath(routes.admin.assets)
  return { ok: true }
}
