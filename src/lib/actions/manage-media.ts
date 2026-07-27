"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@clerk/nextjs/server"

import { isOwner } from "@/lib/admin/owner"
import { purgeMediaArtifacts } from "@/lib/media-erasure"
import type { MediaPurpose } from "@/lib/media"
import { objectUrl } from "@/lib/storage/scaleway"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * Owner-side media + consent management: record a client's image, archive it,
 * set the service feature image, and REQUEST the client's consent to publish an
 * image (site/SoMe) or use their data. The client decides via client-consent.ts;
 * the owner never grants on their behalf.
 */

export type MediaActionResult = { ok: true } | { ok: false; error: string }

async function requireOwner() {
  const { userId, sessionClaims } = await auth()
  if (!userId || !isOwner(sessionClaims)) return null
  return createSupabaseServiceRoleClient()
}

export async function addClientMedia(input: {
  clerkUserId: string
  source: "owner" | "client"
  storageKey: string
  kind: "image" | "video"
  serviceId?: string | null
  bookingId?: string | null
  caption?: string | null
}): Promise<MediaActionResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }
  if (!input.storageKey) return { ok: false, error: "No file uploaded." }

  // Optional booking link: verify it's this client's booking, and inherit its
  // service so the image also associates to the product. A mismatched/unknown
  // booking is dropped (the link is optional) rather than failing the upload.
  let serviceId = input.serviceId ?? null
  let bookingId = input.bookingId ?? null
  if (bookingId) {
    const { data: booking } = await supabase
      .from("bookings")
      .select("id, clerk_user_id, selected_addons")
      .eq("id", bookingId)
      .maybeSingle()
    if (!booking || booking.clerk_user_id !== input.clerkUserId) {
      bookingId = null
    } else if (!serviceId) {
      serviceId =
        (booking.selected_addons as { serviceId?: string } | null)?.serviceId ??
        null
    }
  }

  const { error } = await supabase.from("client_media").insert({
    clerk_user_id: input.clerkUserId,
    source: input.source,
    kind: input.kind,
    storage_key: input.storageKey,
    url: objectUrl(input.storageKey) ?? "",
    service_id: serviceId,
    booking_id: bookingId,
    caption: input.caption ?? null,
  })
  if (error) return { ok: false, error: "Couldn’t add the image." }

  revalidatePath(`/admin/clients/${input.clerkUserId}`)
  if (serviceId) revalidatePath(`/admin/services/${serviceId}`)
  return { ok: true }
}

export async function archiveClientMedia(
  id: string,
  clerkUserId: string,
): Promise<MediaActionResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  // Real erasure: destroy the stored files, then archive the row.
  await purgeMediaArtifacts(id)
  const { error } = await supabase
    .from("client_media")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
  if (error) return { ok: false, error: "Couldn’t remove the image." }

  revalidatePath(`/admin/clients/${clerkUserId}`)
  return { ok: true }
}

/** Make an image the service's feature (one per service — clear the current). */
export async function setFeatureMedia(
  serviceId: string,
  mediaId: string,
): Promise<MediaActionResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  await supabase
    .from("client_media")
    .update({ is_feature: false })
    .eq("service_id", serviceId)
    .eq("is_feature", true)
  const { error } = await supabase
    .from("client_media")
    .update({ is_feature: true })
    .eq("id", mediaId)
  if (error) return { ok: false, error: "Couldn’t set the feature image." }

  revalidatePath(`/admin/services/${serviceId}`)
  return { ok: true }
}

/** Ask the client to consent to publishing an image for a purpose. Resets a
    previously declined/withdrawn request back to `requested`. */
export async function requestMediaPublish(
  mediaId: string,
  clerkUserId: string,
  purpose: MediaPurpose,
): Promise<MediaActionResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const { error } = await supabase.from("media_consents").upsert(
    {
      client_media_id: mediaId,
      clerk_user_id: clerkUserId,
      purpose,
      status: "requested",
      requested_at: new Date().toISOString(),
      granted_at: null,
      declined_at: null,
      withdrawn_at: null,
      published_asset_id: null,
    },
    { onConflict: "client_media_id,purpose" },
  )
  if (error) return { ok: false, error: "Couldn’t request consent." }

  revalidatePath(`/admin/clients/${clerkUserId}`)
  return { ok: true }
}

/** Ask the client to consent to using their data (name / testimonial). */
export async function requestDataConsent(
  clerkUserId: string,
  purpose:
    | "testimonial_site"
    | "testimonial_some"
    | "name_site"
    | "name_some",
): Promise<MediaActionResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const { error } = await supabase.from("client_consents").upsert(
    {
      clerk_user_id: clerkUserId,
      purpose,
      status: "requested",
      requested_at: new Date().toISOString(),
      granted_at: null,
      declined_at: null,
      withdrawn_at: null,
    },
    { onConflict: "clerk_user_id,purpose" },
  )
  if (error) return { ok: false, error: "Couldn’t request consent." }

  revalidatePath(`/admin/clients/${clerkUserId}`)
  return { ok: true }
}
