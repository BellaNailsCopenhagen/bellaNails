"use server"

import { revalidatePath } from "next/cache"

import { requireOwner } from "@/lib/admin/require-owner"
import type { MediaPurpose } from "@/lib/media"
import { objectUrl } from "@/platform/storage/scaleway"

/**
 * Owner-side media + consent management: record a client's image, archive it,
 * set the service feature image, and REQUEST the client's consent to publish an
 * image (site/SoMe) or use their data. The client decides via client-consent.ts;
 * the owner never grants on their behalf.
 */

export type MediaActionResult = { ok: true } | { ok: false; error: string }

export async function addClientMedia(input: {
  clientId: string
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
      .select("id, client_id, selected_addons")
      .eq("id", bookingId)
      .maybeSingle()
    if (!booking || booking.client_id !== input.clientId) {
      bookingId = null
    } else if (!serviceId) {
      serviceId =
        (booking.selected_addons as { serviceId?: string } | null)?.serviceId ??
        null
    }
  }

  const { error } = await supabase.from("client_media").insert({
    client_id: input.clientId,
    source: input.source,
    kind: input.kind,
    storage_key: input.storageKey,
    url: objectUrl(input.storageKey) ?? "",
    service_id: serviceId,
    booking_id: bookingId,
    caption: input.caption ?? null,
  })
  if (error) {
    console.error("[addClientMedia] insert failed:", error.message)
    return { ok: false, error: "Couldn’t add the image." }
  }

  revalidatePath(`/admin/clients/${input.clientId}`)
  if (serviceId) revalidatePath(`/admin/services/${serviceId}`)
  return { ok: true }
}

// A fresh "requested" consent row — resets any prior declined/withdrawn state.
function requestedConsentRow(
  mediaId: string,
  clientId: string,
  purpose: MediaPurpose,
) {
  return {
    client_media_id: mediaId,
    client_id: clientId,
    purpose,
    status: "requested",
    requested_at: new Date().toISOString(),
    granted_at: null,
    declined_at: null,
    withdrawn_at: null,
    needs_takedown_at: null,
    published_asset_id: null,
  }
}

/** Ask the client to consent to publishing an image for a purpose. */
export async function requestMediaPublish(
  mediaId: string,
  clientId: string,
  purpose: MediaPurpose,
): Promise<MediaActionResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const { error } = await supabase
    .from("media_consents")
    .upsert(requestedConsentRow(mediaId, clientId, purpose), {
      onConflict: "client_media_id,purpose",
    })
  if (error) return { ok: false, error: "Couldn’t request consent." }

  revalidatePath(`/admin/clients/${clientId}`)
  return { ok: true }
}

/** Request BOTH website + social in one go (from the hub's New tab, so the card
    doesn't jump to Awaiting after only one purpose). */
export async function requestBothPublish(
  mediaId: string,
  clientId: string,
): Promise<MediaActionResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const { error } = await supabase.from("media_consents").upsert(
    [
      requestedConsentRow(mediaId, clientId, "site"),
      requestedConsentRow(mediaId, clientId, "some"),
    ],
    { onConflict: "client_media_id,purpose" },
  )
  if (error) return { ok: false, error: "Couldn’t request consent." }

  revalidatePath(`/admin/clients/${clientId}`)
  return { ok: true }
}

/** Ask the client to consent to using their data (name / testimonial). */
export async function requestDataConsent(
  clientId: string,
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
      client_id: clientId,
      purpose,
      status: "requested",
      requested_at: new Date().toISOString(),
      granted_at: null,
      declined_at: null,
      withdrawn_at: null,
    },
    { onConflict: "client_id,purpose" },
  )
  if (error) return { ok: false, error: "Couldn’t request consent." }

  revalidatePath(`/admin/clients/${clientId}`)
  return { ok: true }
}
