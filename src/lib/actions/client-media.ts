"use server"

import { auth } from "@clerk/nextjs/server"

import { purgeMediaArtifacts } from "@/lib/media-erasure"
import { objectUrl } from "@/lib/storage/scaleway"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * The CLIENT's own photo uploads, from their /bookings. They add photos to one
 * of their own bookings (verified server-side); the studio can see them for the
 * service relationship. Publishing them anywhere still needs the separate
 * consent in the consent centre — an upload here is never a publish.
 */

export type ClientMediaResult = { ok: true } | { ok: false; error: string }

async function callerId(): Promise<string | null> {
  const { userId } = await auth()
  return userId ?? null
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
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, clerk_user_id, selected_addons")
    .eq("id", input.bookingId)
    .maybeSingle()
  if (!booking || booking.clerk_user_id !== userId) {
    return { ok: false, error: "not_found" }
  }

  const serviceId =
    (booking.selected_addons as { serviceId?: string } | null)?.serviceId ?? null

  const { error } = await supabase.from("client_media").insert({
    clerk_user_id: userId,
    source: "client",
    kind: "image", // clients only upload images (decision 9)
    storage_key: input.storageKey,
    url: objectUrl(input.storageKey) ?? "",
    booking_id: input.bookingId,
    service_id: serviceId,
    caption: input.caption ?? null,
  })
  if (error) return { ok: false, error: "Couldn’t save the photo." }
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
  const { data: media } = await supabase
    .from("client_media")
    .select("clerk_user_id")
    .eq("id", mediaId)
    .maybeSingle()
  if (!media || media.clerk_user_id !== userId) {
    return { ok: false, error: "not_found" }
  }

  await purgeMediaArtifacts(mediaId)
  await supabase
    .from("client_media")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", mediaId)
  return { ok: true }
}
