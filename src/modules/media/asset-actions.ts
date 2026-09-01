"use server"

import { revalidatePath } from "next/cache"

import { placeAsset } from "@/db/asset-usages"
import {
  deleteAsset,
  getAssetStorageKey,
  insertAsset,
  listAssetsForMediaByPurpose,
  listWebsiteAssetsForMedia,
} from "@/db/assets"
import {
  listMediaForPublish,
  setMediaDismissed as setMediaDismissedAt,
  setMediaFavorited as setMediaFavoritedAt,
  type MediaPublishRow,
} from "@/db/client-media"
import { deleteGalleryItemsForAsset } from "@/db/gallery-items"
import {
  isBookingReleased,
  listGrantedReleaseBookings,
} from "@/db/media-releases"
import { requireOwner } from "@/modules/identity/require-owner"
import { revalidatePublicSurfaces } from "@/modules/revalidate"
import { deleteObject, publishToPublic } from "@/platform/storage/supabase"
import { routes } from "@/shared/routes"

export type AssetHubResult = { ok: true; note?: string } | { ok: false; error: string }

type ServiceClient = Awaited<ReturnType<typeof requireOwner>>

type PublishPurpose = "website" | "social"

/**
 * Publish a public copy of ONE original for a purpose — the artist's curation
 * step, gated by the booking's granted release (consent is the ceiling; the
 * artist picks which shots to actually publish). Copy-on-publish: a public
 * storage copy + an `assets` row tied to the original. Degrades cleanly when
 * storage isn't configured. Returns the new asset id so callers can place it.
 */
async function publishOne(
  supabase: NonNullable<ServiceClient>,
  media: MediaPublishRow,
  purpose: PublishPurpose,
): Promise<{ ok: true; assetId?: string; note?: string } | { ok: false; error: string }> {
  if (!media.booking_id) return { ok: false, error: "Image isn’t linked to a booking." }
  if (!(await isBookingReleased(supabase, media.booking_id, purpose))) {
    return { ok: false, error: "The client hasn’t released this booking for that use." }
  }
  // Idempotent — one public copy per (original, purpose). A repeat/racy call
  // reuses the existing copy instead of leaking a duplicate object + row.
  const existing = await listAssetsForMediaByPurpose(supabase, [media.id], purpose)
  if (existing.length) return { ok: true, assetId: existing[0].id }
  if (!media.storage_key) return { ok: false, error: "Image file is missing." }

  const published = await publishToPublic(media.storage_key)
  if (!published.ok) {
    return {
      ok: true,
      note:
        published.error === "not_configured"
          ? "Storage isn’t set up yet — publishing is deferred."
          : "Publishing the file failed — we’ll retry.",
    }
  }

  const asset = await insertAsset(supabase, {
    url: published.data.url,
    media_type: media.kind ?? "image",
    storage_key: published.data.key,
    client_media_id: media.id,
    purpose,
  })
  return asset.ok ? { ok: true, assetId: asset.id } : { ok: false, error: "Couldn’t save the copy." }
}

/** Publish one image/video for a purpose (hub card action). */
export async function publishMedia(
  mediaId: string,
  purpose: PublishPurpose,
): Promise<AssetHubResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const [media] = await listMediaForPublish(supabase, [mediaId])
  if (!media) return { ok: false, error: "not_found" }

  const result = await publishOne(supabase, media, purpose)
  if (!result.ok) return result

  revalidatePath(routes.admin.assets)
  if (purpose === "website") revalidatePublicSurfaces()
  return { ok: true, note: result.note }
}

/**
 * Bulk "add to website gallery" — for each selected original whose booking is
 * released for website, publish its copy (or reuse an existing one) and place it
 * on the clients_gallery surface. Originals whose booking isn't released are
 * skipped and reported (the release is booking-level, requested separately).
 */
export async function bulkAddToGallery(
  mediaIds: string[],
): Promise<AssetHubResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }
  if (!mediaIds.length) return { ok: true }

  const media = await listMediaForPublish(supabase, mediaIds)
  const releasedBookings = new Set(
    await listGrantedReleaseBookings(
      supabase,
      media.map((m) => m.booking_id ?? "").filter(Boolean),
      "website",
    ),
  )
  const existing = new Map(
    (await listWebsiteAssetsForMedia(supabase, mediaIds)).map((a) => [
      a.client_media_id,
      a.id,
    ]),
  )

  let placed = 0
  let skipped = 0
  for (const m of media) {
    let assetId = existing.get(m.id) ?? undefined
    if (!assetId) {
      if (!m.booking_id || !releasedBookings.has(m.booking_id)) {
        skipped++
        continue
      }
      const published = await publishOne(supabase, m, "website")
      if (!published.ok || !published.assetId) {
        skipped++
        continue
      }
      assetId = published.assetId
    }
    await placeAsset(supabase, assetId, "clients_gallery", null)
    placed++
  }

  revalidatePath(routes.admin.assets)
  revalidatePublicSurfaces()
  return {
    ok: true,
    note: skipped
      ? `Added ${placed}. ${skipped} skipped — booking not released, or publishing unavailable.`
      : undefined,
  }
}

/**
 * The artist confirms a withdrawn-but-live social copy has been removed from the
 * external platform — now erase the kept public copy for real. Keyed on the asset
 * (which carries `needs_takedown_at` since the media_consents refactor).
 */
export async function confirmTakedown(assetId: string): Promise<AssetHubResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const storageKey = await getAssetStorageKey(supabase, assetId)
  await deleteGalleryItemsForAsset(supabase, assetId)
  // Deleting the asset cascades its asset_usages.
  await deleteAsset(supabase, assetId)
  if (storageKey) await deleteObject(storageKey)

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
