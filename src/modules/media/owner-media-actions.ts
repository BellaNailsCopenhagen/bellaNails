"use server"

import { revalidatePath } from "next/cache"

import { getBookingOwner } from "@/db/bookings"
import { insertMedia } from "@/db/client-media"
import { upsertDataConsent } from "@/db/client-consents"
import {
  listReleasesForBookings,
  upsertReleases,
  type ReleasePurpose,
  type ReleaseUpsert,
} from "@/db/media-releases"
import { approveUrlFor } from "@/modules/booking/manage-token"
import { fetchClientContacts } from "@/modules/clients/contacts"
import { requireOwner } from "@/modules/identity/require-owner"
import {
  recordCommunication,
  statusFromEmailResult,
} from "@/modules/notifications/communications"
import { sendMediaReleaseRequestEmail } from "@/modules/notifications/release-email"
import { objectUrl } from "@/platform/storage/supabase"
import { localizedBookingNames, metaOf } from "@/shared/booking-policy"
import { bookingRef } from "@/shared/media-release"
import { routes } from "@/shared/routes"
import { formatStudioDate } from "@/shared/studio-time"

/**
 * Owner-side media + consent management: record a client's image, and REQUEST the
 * client's BOOKING-LEVEL release to use that appointment's media (website / social
 * / education) or to use their data (name / testimonial). The client decides via
 * release-actions.ts; the owner never grants on their behalf.
 */

export type MediaActionResult = { ok: true } | { ok: false; error: string }

export async function addClientMedia(input: {
  clientId: string
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
    const booking = await getBookingOwner(supabase, bookingId)
    if (!booking || booking.client_id !== input.clientId) {
      bookingId = null
    } else if (!serviceId) {
      serviceId =
        (booking.selected_addons as { serviceId?: string } | null)?.serviceId ??
        null
    }
  }

  const saved = await insertMedia(supabase, {
    client_id: input.clientId,
    // Every photo here is shot by the studio — clients no longer upload.
    source: "owner",
    kind: input.kind,
    storage_key: input.storageKey,
    url: objectUrl(input.storageKey) ?? "",
    service_id: serviceId,
    booking_id: bookingId,
    caption: input.caption ?? null,
  })
  if (!saved.ok) {
    console.error("[addClientMedia] insert failed:", saved.message)
    return { ok: false, error: "Couldn’t add the image." }
  }

  revalidatePath(routes.admin.client(input.clientId))
  if (serviceId) revalidatePath(routes.admin.service(serviceId))
  return { ok: true }
}

// A fresh "requested" release row — resets any prior declined/withdrawn state.
function requestedReleaseRow(
  bookingId: string,
  clientId: string,
  purpose: ReleasePurpose,
): ReleaseUpsert {
  return {
    booking_id: bookingId,
    client_id: clientId,
    purpose,
    status: "requested",
    requested_at: new Date().toISOString(),
    granted_at: null,
    declined_at: null,
    withdrawn_at: null,
  }
}

/** Email the client the approval link + log it. Best-effort — a mail failure
    must not fail the request (the ask is also visible in My Space). */
async function emailReleaseRequest(
  bookingId: string,
  clientId: string,
  selectedAddons: unknown,
  startIso: string | null,
  purposes: ReleasePurpose[],
): Promise<void> {
  const contact = (await fetchClientContacts([clientId]))[clientId]
  if (!contact?.email) return
  const locale = contact.communicationLocale
  const approveUrl = approveUrlFor(locale, bookingId)
  if (!approveUrl) return

  const { serviceName } = localizedBookingNames(metaOf({ selected_addons: selectedAddons }), locale)
  const when = startIso ? formatStudioDate(startIso, locale) : ""

  const res = await sendMediaReleaseRequestEmail({
    to: contact.email,
    firstName: contact.firstName,
    locale,
    serviceName,
    when,
    ref: bookingRef(bookingId),
    purposes,
    approveUrl,
  })
  await recordCommunication({
    clientId,
    bookingId,
    kind: "media_release_request",
    trigger: "manual",
    recipient: contact.email,
    status: statusFromEmailResult(res),
    error: res.error,
  })
}

/** Ask the client to release a BOOKING's media for one or more purposes. Covers
    every photo + video from that appointment (consent is booking-level). */
export async function requestMediaRelease(
  bookingId: string,
  purposes: ReleasePurpose[],
): Promise<MediaActionResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }
  if (purposes.length === 0) return { ok: true }

  const booking = await getBookingOwner(supabase, bookingId)
  if (!booking) return { ok: false, error: "Booking not found." }

  // Only ask for what's still open: skip purposes the client already GRANTED
  // (e.g. pre-approved at booking) — re-requesting must never reset a grant.
  const existing = await listReleasesForBookings(supabase, [bookingId])
  const granted = new Set(
    existing.filter((r) => r.status === "granted").map((r) => r.purpose),
  )
  const toRequest = purposes.filter((p) => !granted.has(p))
  if (toRequest.length === 0) return { ok: true } // all purposes already granted

  // The approval link already lists every currently-requested purpose, so if a
  // request is pending we skip a second email — the existing link covers the
  // newly-added purpose too.
  const alreadyPending = existing.some((r) => r.status === "requested")

  const saved = await upsertReleases(
    supabase,
    toRequest.map((p) => requestedReleaseRow(bookingId, booking.client_id, p)),
  )
  if (!saved.ok) return { ok: false, error: "Couldn’t request the release." }

  revalidatePath(routes.admin.client(booking.client_id))
  if (!alreadyPending) {
    await emailReleaseRequest(
      bookingId,
      booking.client_id,
      booking.selected_addons,
      booking.start_time,
      toRequest,
    )
  }
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

  const saved = await upsertDataConsent(supabase, {
    client_id: clientId,
    purpose,
    status: "requested",
    requested_at: new Date().toISOString(),
    granted_at: null,
    declined_at: null,
    withdrawn_at: null,
  })
  if (!saved.ok) return { ok: false, error: "Couldn’t request consent." }

  revalidatePath(routes.admin.client(clientId))
  return { ok: true }
}
