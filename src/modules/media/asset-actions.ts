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
import {
  isPublicSurface,
  isAssetSurface,
  surfacesForPurpose,
} from "@/shared/asset-surfaces"
import { routes } from "@/shared/routes"

export type AssetHubResult =
  { ok: true; note?: string } | { ok: false; error: string }

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
): Promise<
  | { ok: true; assetId?: string; created?: boolean; note?: string }
  | { ok: false; error: string }
> {
  if (!media.booking_id) {
    return { ok: false, error: "Image isn’t linked to a booking." }
  }
  if (!(await isBookingReleased(supabase, media.booking_id, purpose))) {
    return {
      ok: false,
      error: "The client hasn’t released this booking for that use.",
    }
  }
  // Idempotent — one public copy per (original, purpose). A repeat/racy call
  // reuses the existing copy instead of leaking a duplicate object + row.
  const existing = await listAssetsForMediaByPurpose(
    supabase,
    [media.id],
    purpose,
  )
  if (existing.length) {
    return { ok: true, assetId: existing[0].id, created: false }
  }
  if (!media.storage_key) {
    return { ok: false, error: "Image file is missing." }
  }

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

  return asset.ok
    ? { ok: true, assetId: asset.id, created: true }
    : { ok: false, error: "Couldn’t save the copy." }
}

/**
 * Put a photo on a surface, making the public copy if this is the first place it
 * goes. One step, deliberately: publishing used to be its own button, which left
 * a world-readable file sitting on no surface — public, rendered nowhere, and
 * indistinguishable in the hub from a photo that had never been published.
 */
export async function placeMedia(
  mediaId: string,
  purpose: PublishPurpose,
  surface: string,
): Promise<AssetHubResult> {
  const supabase = await requireOwner()
  if (!supabase) {
    return { ok: false, error: "unauthorized" }
  }
  if (!isAssetSurface(surface)) {
    return { ok: false, error: "Unknown use-case." }
  }
  // Never trust the card's gating: the surface has to be one this consent covers.
  if (!surfacesForPurpose(purpose).includes(surface)) {
    return {
      ok: false,
      error: "That use-case isn’t covered by the client’s consent.",
    }
  }

  const [media] = await listMediaForPublish(supabase, [mediaId])
  if (!media) {
    return { ok: false, error: "not_found" }
  }

  const published = await publishOne(supabase, media, purpose)
  if (!published.ok) {
    return published
  }
  // Storage not configured — publishOne reports it and there is nothing to place.
  if (!published.assetId) {
    return { ok: true, note: published.note }
  }

  const placed = await placeAsset(supabase, published.assetId, surface, null)
  if (!placed.ok) {
    // Roll back a copy we just made: publishing exists to serve this placement,
    // and leaving it behind is the world-readable orphan this flow removed. Only
    // ours — an existing copy may be in use on a service section or a gallery
    // item, neither of which is an `asset_usages` row.
    if (published.created) {
      const key = await getAssetStorageKey(supabase, published.assetId)
      if (key) {
        await deleteObject(key)
      }
      await deleteAsset(supabase, published.assetId)
    }

    return { ok: false, error: "Couldn’t save the use-case." }
  }

  revalidatePath(routes.admin.assets)
  if (isPublicSurface(surface)) {
    revalidatePublicSurfaces()
  }

  return { ok: true, note: published.note }
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
  if (!supabase) {
    return { ok: false, error: "unauthorized" }
  }
  if (!mediaIds.length) {
    return { ok: true }
  }

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
export async function confirmTakedown(
  assetId: string,
): Promise<AssetHubResult> {
  const supabase = await requireOwner()
  if (!supabase) {
    return { ok: false, error: "unauthorized" }
  }

  // Unconditional, unlike retireAssetIfUnused: consent is gone, so the copy goes
  // even if a service section or a gallery item still shows it. Those losing
  // their picture is the correct consequence of a withdrawal, not a reason to
  // keep publishing one.
  //
  // FILE FIRST. The row is the only thing that still points at the object, so
  // dropping it while the file survives leaves a withdrawn photo world-readable
  // with nothing left to retry the delete — the one outcome a takedown exists to
  // prevent.
  const storageKey = await getAssetStorageKey(supabase, assetId)
  if (storageKey) {
    const gone = await deleteObject(storageKey)
    if (!gone.ok) {
      console.error(
        `[takedown] file for asset ${assetId} not deleted:`,
        gone.error,
      )

      return {
        ok: false,
        error:
          "Couldn’t delete the file — the photo is still public. Try again.",
      }
    }
  }
  await deleteGalleryItemsForAsset(supabase, assetId)
  // Deleting the asset cascades its asset_usages.
  await deleteAsset(supabase, assetId)

  revalidatePath(routes.admin.assets)
  revalidatePublicSurfaces()

  return { ok: true }
}

/** Heart (or un-heart) a photo — the artist's curation shortlist, available in
    any state, independent of consent. */
export async function setMediaFavorite(
  mediaId: string,
  favorite: boolean,
): Promise<AssetHubResult> {
  const supabase = await requireOwner()
  if (!supabase) {
    return { ok: false, error: "unauthorized" }
  }

  const saved = await setMediaFavoritedAt(
    supabase,
    mediaId,
    favorite ? new Date().toISOString() : null,
  )
  if (!saved.ok) {
    return { ok: false, error: "Couldn’t update." }
  }

  revalidatePath(routes.admin.assets)

  return { ok: true }
}

/** Set a photo aside, or take it back off the shelf — the artist's own "not
    using this one". Deleting is not the alternative: the client sees these
    photos in My Space, so the image has to stay. Orthogonal to consent, which is
    why it filters the hub rather than appearing in a photo's state. */
export async function setMediaSetAside(
  mediaId: string,
  setAside: boolean,
): Promise<AssetHubResult> {
  const supabase = await requireOwner()
  if (!supabase) {
    return { ok: false, error: "unauthorized" }
  }

  const saved = await setMediaDismissedAt(
    supabase,
    mediaId,
    setAside ? new Date().toISOString() : null,
  )
  if (!saved.ok) {
    return { ok: false, error: "Couldn’t update." }
  }

  revalidatePath(routes.admin.assets)

  return { ok: true }
}
