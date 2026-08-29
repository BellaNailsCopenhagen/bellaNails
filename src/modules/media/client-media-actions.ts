"use server"

import { getCurrentUser } from "@/modules/identity/server"
import { notifyOwner } from "@/modules/notifications/notify"
import { purgeMediaArtifacts } from "@/modules/media/erasure"
import { objectUrl } from "@/platform/storage/scaleway"
import {
  archiveMedia,
  getMediaOwner,
  insertMedia,
} from "@/db/client-media"
import { hasPublishedAssetForMedia } from "@/db/assets"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"
import { getBookingOwner } from "@/db/bookings"

/**
 * The CLIENT's own photo uploads, from their /bookings. They add photos to one
 * of their own bookings (verified server-side); the studio can see them for the
 * service relationship. Publishing them anywhere still needs the separate
 * consent in the consent centre — an upload here is never a publish.
 */

export type ClientMediaResult = { ok: true } | { ok: false; error: string }

async function callerId(): Promise<string | null> {
  const user = await getCurrentUser()
  return user?.id ?? null
}

export async function addOwnBookingMedia(input: {
  bookingId: string
  storageKey: string
  caption?: string | null
}): Promise<ClientMediaResult> {
  const userId = await callerId()
  if (!userId) return { ok: false, error: "unauthorized" }
  if (!input.storageKey) return { ok: false, error: "No image." }

  const supabase = createSupabaseServiceRoleClient()
  const booking = await getBookingOwner(supabase, input.bookingId)
  if (!booking || booking.client_id !== userId) {
    console.error("[addOwnBookingMedia] booking not found/owned", {
      bookingId: input.bookingId,
      found: Boolean(booking),
    })
    return { ok: false, error: "not_found" }
  }

  const serviceId =
    (booking.selected_addons as { serviceId?: string } | null)?.serviceId ?? null

  const saved = await insertMedia(supabase, {
    client_id: userId,
    source: "client",
    kind: "image", // clients only upload images (decision 9)
    storage_key: input.storageKey,
    url: objectUrl(input.storageKey) ?? "",
    booking_id: input.bookingId,
    service_id: serviceId,
    caption: input.caption ?? null,
  })
  if (!saved.ok) {
    console.error("[addOwnBookingMedia] insert failed:", saved.message)
    return { ok: false, error: "Couldn’t save the photo." }
  }
  return { ok: true }
}

/** The client removes a photo they added — real erasure: destroy the stored
    files (private + any published copies), then archive the row. */
export async function deleteOwnMedia(
  mediaId: string,
): Promise<ClientMediaResult> {
  const userId = await callerId()
  if (!userId) return { ok: false, error: "unauthorized" }

  const supabase = createSupabaseServiceRoleClient()
  const owner = await getMediaOwner(supabase, mediaId)
  if (owner !== userId) return { ok: false, error: "not_found" }

  // Was this image published anywhere? If so, deleting it fully erases the
  // published copy too (and its use-cases cascade away) — so leave the studio a
  // note to check their showcases / social posts.
  const wasShared = await hasPublishedAssetForMedia(supabase, mediaId)

  await purgeMediaArtifacts(mediaId)
  await archiveMedia(supabase, mediaId)

  if (wasShared) {
    await notifyOwner(supabase, { kind: "shared_image_deleted", clientId: userId })
  }
  return { ok: true }
}
