"use server"

import { revalidatePath } from "next/cache"

import {
  getBookingRequest,
  insertBookingRequest,
  updateBookingRequest,
} from "@/db/booking-requests"
import { insertBooking } from "@/db/bookings"
import { resolveLocale } from "@/i18n/routing"
import { buildBookingDraft } from "@/modules/booking/booking-draft"
import { manageUrlFor } from "@/modules/booking/manage-token"
import { fetchClientContacts } from "@/modules/clients"
import { ensureUser } from "@/modules/identity/ensure-user"
import { requireOwner } from "@/modules/identity/require-owner"
import { sendBookingConfirmationEmail } from "@/modules/notifications/booking-email"
import {
  recordCommunication,
  statusFromEmailResult,
} from "@/modules/notifications/communications"
import { notifyOwner } from "@/modules/notifications/notify"
import {
  sendBookingRequestArtistEmail,
  sendBookingRequestDeclinedEmail,
  sendBookingRequestReceivedEmail,
} from "@/modules/notifications/request-email"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"
import { localizedBookingNames, metaOf } from "@/shared/booking-policy"
import { serviceRef } from "@/shared/booking-subject"
import { BOOKING_STATUS } from "@/shared/booking-status"
import { EMAIL_PATTERN, toE164 } from "@/shared/contact-validation"
import { routes } from "@/shared/routes"

const MIN = 60_000

// The booked window length: from the snapshot, else the request's own start→end
// span (never 0/negative) — so adjusting the start keeps the appointment length.
function requestDurationMs(request: {
  start_time: string
  end_time: string
  selected_addons: unknown
}): number {
  const mins = metaOf(request).totalDurationMins
  if (mins != null) return mins * MIN
  return Math.max(
    0,
    new Date(request.end_time).getTime() - new Date(request.start_time).getTime(),
  )
}

export type RequestActionResult = { ok: true } | { ok: false; error: string }

export type CreateRequestInput = {
  serviceId: string
  addonIds: string[]
  // over_limit: the slot they already picked; outside_hours: their ideal date+time.
  start: string
  kind: "outside_hours" | "over_limit"
  name: string
  email: string
  phone?: string
  message?: string
  locale?: string
  honeypot?: string
}

/**
 * A client asks for a slot the self-service flow won't grant (outside hours, or
 * past the 2-active cap). Public — a guest requests by email. Builds the same
 * as-booked snapshot as a booking but WITHOUT a slot check, records the request,
 * alerts the artist in-app, and emails the client a clear "received, not yet
 * confirmed" acknowledgement.
 */
export async function createBookingRequest(
  input: CreateRequestInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (input.honeypot?.trim()) return { ok: false, error: "Couldn't send the request." }
  const email = input.email.trim().toLowerCase()
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return { ok: false, error: "Enter a valid email." }
  }

  // The slot check is off for a request, so guard the time here: must be in the
  // future and within a year (an outside-hours pick is otherwise unbounded).
  const startMs = new Date(input.start).getTime()
  const nowMs = Date.now()
  if (!Number.isFinite(startMs) || startMs < nowMs) {
    return { ok: false, error: "Pick a time in the future." }
  }
  if (startMs > nowMs + 366 * 24 * 60 * 60 * 1000) {
    return { ok: false, error: "That's too far ahead — pick a nearer date." }
  }

  const db = createSupabaseServiceRoleClient()
  const prepared = await buildBookingDraft(
    db,
    {
      ref: serviceRef(input.serviceId, input.addonIds),
      start: input.start,
      locale: input.locale,
    },
    { checkSlot: false },
  )
  if (!prepared.ok) return prepared
  const { draft } = prepared

  let clientId: string
  try {
    clientId = await ensureUser({
      email,
      name: input.name.trim() || undefined,
      phone: input.phone ? (toE164(input.phone) ?? input.phone.trim()) : undefined,
    })
  } catch {
    return { ok: false, error: "Couldn't save your details — please try again." }
  }

  const saved = await insertBookingRequest(db, {
    client_id: clientId,
    kind: input.kind,
    start_time: input.start,
    end_time: draft.endIso,
    selected_addons: draft.values.selected_addons,
    total_price_cents: draft.subject.priceCents,
    message: input.message?.trim() || null,
  })
  if (!saved.ok) return { ok: false, error: "Couldn't save the request — please try again." }

  const locale = resolveLocale(input.locale)
  // In-app alert for the artist (best-effort). Push lands with Feature C.
  await notifyOwner(db, { kind: "booking_request", clientId })

  const { serviceName, addonNames } = localizedBookingNames(
    metaOf({ selected_addons: draft.values.selected_addons }),
    locale,
  )
  // Client ack + artist alert are independent — send both in parallel (the
  // artist email needs a timely human decision; an in-app alert is easy to miss).
  const [res] = await Promise.all([
    sendBookingRequestReceivedEmail({
      to: email,
      firstName: input.name.trim().split(/\s+/)[0] || null,
      locale,
      kind: input.kind,
      serviceName,
      addonNames,
      startIso: input.start,
      priceCents: draft.subject.priceCents,
      message: input.message?.trim() || null,
    }),
    sendBookingRequestArtistEmail({
      requestId: saved.id,
      clientName: input.name.trim() || email,
      clientEmail: email,
      clientPhone: input.phone?.trim() || null,
      kind: input.kind,
      serviceName,
      startIso: input.start,
      message: input.message?.trim() || null,
    }),
  ])
  await recordCommunication({
    clientId,
    bookingId: null,
    kind: "booking_request_received",
    trigger: "auto",
    recipient: email,
    status: statusFromEmailResult(res),
    error: res.error,
  })

  revalidatePath(routes.admin.home)
  return { ok: true, id: saved.id }
}

/** Artist accepts a request → creates the real booking from its snapshot,
    bypassing hours/cap/slot checks (approved). `startIso` lets them adjust the
    time first. The overlap exclusion constraint still blocks a clash. */
export async function acceptBookingRequest(
  requestId: string,
  opts?: { startIso?: string },
): Promise<{ ok: true; bookingId: string } | { ok: false; error: string }> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "Not authorized." }

  const request = await getBookingRequest(db, requestId)
  if (!request) return { ok: false, error: "Request not found." }
  if (request.status !== "pending") {
    return { ok: false, error: "This request was already decided." }
  }

  const meta = metaOf(request)
  const startIso = opts?.startIso ?? request.start_time
  const startMs = new Date(startIso).getTime()
  if (!Number.isFinite(startMs)) return { ok: false, error: "Pick a valid time." }
  const endIso = new Date(startMs + requestDurationMs(request)).toISOString()

  const result = await insertBooking(db, {
    client_id: request.client_id,
    status: BOOKING_STATUS.confirmed,
    start_time: startIso,
    end_time: endIso,
    total_price_cents: request.total_price_cents,
    selected_addons: request.selected_addons,
    client_notes: null,
  })
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "overlap"
          ? "That time overlaps another booking — pick another."
          : "Couldn't create the booking.",
    }
  }

  const flipped = await updateBookingRequest(db, requestId, {
    status: "accepted",
    booking_id: result.id,
    decided_at: new Date().toISOString(),
  })
  // The booking is created either way; if the status flip failed the request
  // stays pending. The overlap exclusion constraint blocks a duplicate on a
  // re-accept, so log it loudly rather than orphaning the created booking.
  if (!flipped.ok) {
    console.error(
      `[booking-request] booking ${result.id} created but request ${requestId} not marked accepted:`,
      flipped.message,
    )
  }

  // Confirmation to the client (best-effort) — a real booking now exists.
  const contact = (await fetchClientContacts([request.client_id]))[request.client_id]
  if (contact?.email) {
    const locale = contact.communicationLocale
    const { serviceName, addonNames } = localizedBookingNames(meta, locale)
    const res = await sendBookingConfirmationEmail({
      to: contact.email,
      firstName: contact.firstName,
      serviceName,
      addonNames,
      startIso,
      endIso,
      priceCents: request.total_price_cents,
      manageUrl: manageUrlFor(locale, result.id),
      bookingId: result.id,
      actor: "studio",
      locale,
    })
    await recordCommunication({
      clientId: request.client_id,
      bookingId: result.id,
      kind: "confirmation",
      trigger: "manual",
      recipient: contact.email,
      status: statusFromEmailResult(res),
      error: res.error,
    })
  }

  revalidatePath(routes.admin.home)
  revalidatePath(routes.admin.appointments)
  return { ok: true, bookingId: result.id }
}

/** Artist rejects a request (with an optional reason) — closes it and tells the
    client kindly. */
export async function rejectBookingRequest(
  requestId: string,
  reason?: string,
): Promise<RequestActionResult> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "Not authorized." }

  const request = await getBookingRequest(db, requestId)
  if (!request) return { ok: false, error: "Request not found." }
  if (request.status !== "pending") {
    return { ok: false, error: "This request was already decided." }
  }

  await updateBookingRequest(db, requestId, {
    status: "rejected",
    reject_reason: reason?.trim() || null,
    decided_at: new Date().toISOString(),
  })

  const contact = (await fetchClientContacts([request.client_id]))[request.client_id]
  if (contact?.email) {
    const locale = contact.communicationLocale
    const { serviceName } = localizedBookingNames(metaOf(request), locale)
    const res = await sendBookingRequestDeclinedEmail({
      to: contact.email,
      firstName: contact.firstName,
      locale,
      serviceName,
      reason: reason?.trim() || null,
    })
    await recordCommunication({
      clientId: request.client_id,
      bookingId: null,
      kind: "booking_request_declined",
      trigger: "manual",
      recipient: contact.email,
      status: statusFromEmailResult(res),
      error: res.error,
    })
  }

  revalidatePath(routes.admin.home)
  return { ok: true }
}

/** Artist adjusts a request's requested time before accepting (end recomputed
    from the snapshot duration). */
export async function updateBookingRequestTime(
  requestId: string,
  startIso: string,
): Promise<RequestActionResult> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "Not authorized." }

  const request = await getBookingRequest(db, requestId)
  if (!request || request.status !== "pending") {
    return { ok: false, error: "Request not found." }
  }
  const startMs = new Date(startIso).getTime()
  if (!Number.isFinite(startMs)) return { ok: false, error: "Pick a valid time." }
  const endIso = new Date(startMs + requestDurationMs(request)).toISOString()

  const saved = await updateBookingRequest(db, requestId, {
    start_time: startIso,
    end_time: endIso,
  })
  if (!saved.ok) return { ok: false, error: "Couldn't update — please try again." }

  revalidatePath(routes.admin.home)
  return { ok: true }
}
