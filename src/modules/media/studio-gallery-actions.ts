"use server"

import { revalidatePath } from "next/cache"

import {
  clearGallerySlot,
  deleteGalleryItem,
  getGalleryItemAsset,
  insertGalleryItem,
  updateGalleryItem,
} from "@/db/gallery-items"
import { requireOwner } from "@/modules/identity/require-owner"
import { retireAssetIfUnused } from "@/modules/media/retire-asset"
import { revalidatePublicSurfaces } from "@/modules/revalidate"
import { isGallerySlot } from "@/shared/gallery-slots"
import { routes } from "@/shared/routes"

/**
 * The STUDIO half of the gallery — the artist's own work, with no client and no
 * consent attached to it.
 *
 * This is the other half of a split the public site has always drawn and the
 * admin never could: /gallery shows studio work above client work, but
 * `gallery_items` had no way in except the seed file.
 *
 * A client's photo must NEVER arrive here. `gallery_items` carries no client,
 * no booking and no release, so nothing in it can be traced back to a consent or
 * taken down when one is withdrawn — which is exactly what a client's photo
 * needs. Those go through the asset hub, where permission is asked per
 * appointment and a withdrawal deletes the public copy. The only way in here is
 * an upload (`publishStudioAsset`), which writes an asset with no
 * `client_media_id`; the picker is deliberately given no pool to choose from.
 */

export type GalleryAdminResult = { ok: true } | { ok: false; error: string }

export async function addGalleryItem(input: {
  assetId: string
  titleEn: string
  titleDa: string
  /** A home-page position, or null for gallery-page only. */
  slot: number | null
}): Promise<GalleryAdminResult> {
  const db = await requireOwner()
  if (!db) {
    return { ok: false, error: "unauthorized" }
  }
  if (!input.assetId) {
    return { ok: false, error: "Upload an image first." }
  }
  if (input.slot !== null && !isGallerySlot(input.slot)) {
    return { ok: false, error: "That isn’t a home-page position." }
  }

  // A unique index enforces one image per position (gallery-ordering.sql), so
  // the position must be vacated first — inserting into a taken one is rejected
  // outright, and the artist was told choosing it would move the other out.
  const displaced =
    input.slot !== null ? await clearGallerySlot(db, input.slot, "") : null
  if (displaced && !displaced.ok) {
    return { ok: false, error: "Couldn’t free that position." }
  }

  const saved = await insertGalleryItem(db, {
    display_mode: "single",
    primary_asset_id: input.assetId,
    title_en: input.titleEn.trim() || null,
    title_dk: input.titleDa.trim() || null,
    sort_order: input.slot,
  })
  if (!saved.ok) {
    // Put the displaced image back — it lost its position for an add that never
    // happened, and nothing else would ever restore it.
    if (displaced?.displacedId && input.slot !== null) {
      await updateGalleryItem(db, displaced.displacedId, {
        sort_order: input.slot,
      })
    }

    return { ok: false, error: "Couldn’t add it." }
  }

  revalidatePath(routes.admin.gallery)
  revalidatePublicSurfaces()

  return { ok: true }
}

/**
 * Throw away a copy that was published for an edit that never happened.
 *
 * The picker publishes the moment a file is chosen — it has to, because the
 * preview IS the public URL — so backing out of the sheet would otherwise leave
 * a world-readable file no row points at, which is exactly what the artist was
 * promised could not happen. Retiring re-checks every table first, so this can
 * never take down a copy something still shows.
 */
export async function discardStudioAsset(
  assetId: string,
): Promise<GalleryAdminResult> {
  const db = await requireOwner()
  if (!db) {
    return { ok: false, error: "unauthorized" }
  }
  if (assetId) {
    await retireAssetIfUnused(db, assetId)
  }

  return { ok: true }
}

export async function setGalleryItemSlot(
  id: string,
  slot: number | null,
): Promise<GalleryAdminResult> {
  const db = await requireOwner()
  if (!db) {
    return { ok: false, error: "unauthorized" }
  }
  if (slot !== null && !isGallerySlot(slot)) {
    return { ok: false, error: "That isn’t a home-page position." }
  }

  // Vacate the position first: a unique index rejects two images in one, so the
  // update would simply fail — and the artist was told this moves the other out.
  const displaced = slot !== null ? await clearGallerySlot(db, slot, id) : null
  if (displaced && !displaced.ok) {
    return { ok: false, error: "Couldn’t free that position." }
  }

  const saved = await updateGalleryItem(db, id, { sort_order: slot })
  if (!saved.ok) {
    if (displaced?.displacedId && slot !== null) {
      await updateGalleryItem(db, displaced.displacedId, { sort_order: slot })
    }

    return { ok: false, error: "Couldn’t move it." }
  }

  revalidatePath(routes.admin.gallery)
  revalidatePublicSurfaces()

  return { ok: true }
}

export async function renameGalleryItem(
  id: string,
  titleEn: string,
  titleDa: string,
): Promise<GalleryAdminResult> {
  const db = await requireOwner()
  if (!db) {
    return { ok: false, error: "unauthorized" }
  }

  const saved = await updateGalleryItem(db, id, {
    title_en: titleEn.trim() || null,
    title_dk: titleDa.trim() || null,
  })
  if (!saved.ok) {
    return { ok: false, error: "Couldn’t save the caption." }
  }

  revalidatePath(routes.admin.gallery)
  revalidatePublicSurfaces()

  return { ok: true }
}

/** Swap the picture, keeping the caption and the slot. The old copy is retired
    if nothing else shows it — a replaced image that stayed in the bucket would be
    a public photo the artist believes she has taken down. */
export async function replaceGalleryImage(
  id: string,
  assetId: string,
): Promise<GalleryAdminResult> {
  const db = await requireOwner()
  if (!db) {
    return { ok: false, error: "unauthorized" }
  }
  if (!assetId) {
    return { ok: false, error: "Upload an image first." }
  }

  const previous = await getGalleryItemAsset(db, id)
  const saved = await updateGalleryItem(db, id, { primary_asset_id: assetId })
  if (!saved.ok) {
    return { ok: false, error: "Couldn’t replace it." }
  }
  if (previous && previous !== assetId) {
    await retireAssetIfUnused(db, previous)
  }

  revalidatePath(routes.admin.gallery)
  revalidatePublicSurfaces()

  return { ok: true }
}

/**
 * Take a studio image down — off the gallery, off the home page, file deleted.
 *
 * This is the retraction path, and it has to be immediate and complete: these
 * images carry no consent record, so if someone ever objects to one the only
 * honest answer is that it is gone. Nothing is kept back — unlike a client's
 * photo, there is no private original and no permission history to preserve.
 */
export async function removeGalleryItem(
  id: string,
): Promise<GalleryAdminResult> {
  const db = await requireOwner()
  if (!db) {
    return { ok: false, error: "unauthorized" }
  }

  const assetId = await getGalleryItemAsset(db, id)
  const removed = await deleteGalleryItem(db, id)
  if (!removed.ok) {
    return { ok: false, error: "Couldn’t remove it." }
  }

  // The row is gone, so the item no longer holds the asset — retire asks the
  // other tables and deletes the file only if nothing else shows it.
  if (assetId) {
    await retireAssetIfUnused(db, assetId)
  }

  revalidatePath(routes.admin.gallery)
  revalidatePublicSurfaces()

  return { ok: true }
}
