"use server"

import { revalidatePath } from "next/cache"

import { insertDesignMessage } from "@/db/design-messages"
import { countDesignRefs, insertDesignRefs } from "@/db/design-refs"
import {
  countActionableDesignRequestsForClient,
  deleteDesignRequest,
  getDesignRequest,
  insertDesignRequest,
  updateDesignRequest,
} from "@/db/design-requests"
import { getBookingOwner } from "@/db/bookings"
import { getLiveOfferForRequest, updateOffer } from "@/db/offers"
import { getPublicServiceRow } from "@/db/services"
import { fetchClientContacts } from "@/modules/clients"
import { getCurrentUser } from "@/modules/identity/server"
import { requireOwner } from "@/modules/identity/require-owner"
import type { EmailResult } from "@/platform/email/client"
import {
  sendDesignReplyEmail,
  sendDesignRequestArtistEmail,
  sendDesignRequestDeclinedEmail,
  sendDesignRequestReceivedEmail,
} from "@/modules/notifications/design-email"
import {
  recordCommunication,
  statusFromEmailResult,
} from "@/modules/notifications/communications"
import { notifyOwner } from "@/modules/notifications/notify"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"
import { contactDisplayName } from "@/shared/contact"
import {
  isActionableDesignStatus,
  isDesignTopic,
  MAX_MESSAGE_LENGTH,
  MAX_OPEN_REQUESTS_PER_CLIENT,
  MAX_PREFERRED_WINDOW_LENGTH,
  MAX_REFS_PER_REQUEST,
} from "@/shared/design"
import { takeToken, type RateLimitState } from "@/shared/rate-limit"
import { routes } from "@/shared/routes"

/**
 * Design requests — the client's async ask, and the artist's non-offer replies.
 * Sign-in is required (that is what gates abuse), and a client may only ever act
 * on their OWN request; ownership is re-checked server-side on every call
 * because the UI is never the boundary.
 */

export type DesignActionResult = { ok: true } | { ok: false; error: string }

// Appending to a thread is cheap for the client and not for us (a row, an owner
// notification, and one more entry on an unpaginated card). Best-effort per
// instance — see shared/rate-limit.ts.
const messages: RateLimitState = new Map()
const MESSAGE_RULE = { limit: 20, windowMs: 60 * 60 * 1000 }

/** Reference uploads land in the `refs/` area. The prefix check confines an
    attachment to that bucket — it is not an ownership proof (keys are random
    uuids, so guessing one is the barrier), but it stops a crafted request from
    pointing a design ref at the artist's own private originals. */
const REF_PREFIX = "refs/"

export type CreateDesignRequestInput = {
  topic: string
  message: string
  /** Storage keys already uploaded by this client through /api/media/sign. */
  refKeys?: string[]
  preferredWindow?: string
  /** Set when the ask came from a past appointment (the repair path). */
  bookingId?: string
  serviceId?: string
}

export async function createDesignRequest(
  input: CreateDesignRequestInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "Please sign in first." }

  if (!isDesignTopic(input.topic)) return { ok: false, error: "Pick what this is about." }
  const message = input.message.trim()
  if (!message) return { ok: false, error: "Tell us what you have in mind." }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: "That message is too long." }
  }
  const preferredWindow = input.preferredWindow?.trim().slice(0, MAX_PREFERRED_WINDOW_LENGTH) || null

  const refKeys = (input.refKeys ?? []).filter((k) => k.startsWith(REF_PREFIX))
  if (refKeys.length > MAX_REFS_PER_REQUEST) {
    return { ok: false, error: `Up to ${MAX_REFS_PER_REQUEST} photos, please.` }
  }

  const db = createSupabaseServiceRoleClient()

  // One person can only have so much open at once — keeps the queue honest.
  try {
    const open = await countActionableDesignRequestsForClient(db, user.id)
    if (open >= MAX_OPEN_REQUESTS_PER_CLIENT) {
      return {
        ok: false,
        error: "You already have a few open messages — we'll reply to those first.",
      }
    }
  } catch {
    /* a count hiccup must not block a genuine message */
  }

  // A repair points at one of the client's OWN past appointments.
  let bookingId: string | null = null
  if (input.bookingId) {
    const booking = await getBookingOwner(db, input.bookingId).catch(() => null)
    if (booking?.client_id === user.id) bookingId = input.bookingId
  }

  // `?service=` arrives from a link and lands in a uuid FK — drop it unless it
  // resolves, so a stale or crafted value can't fail every submit.
  const serviceId = input.serviceId
    ? ((await getPublicServiceRow(db, input.serviceId).catch(() => null))?.id ?? null)
    : null

  const saved = await insertDesignRequest(db, {
    client_id: user.id,
    topic: input.topic,
    service_id: serviceId,
    booking_id: bookingId,
    preferred_window: preferredWindow,
  })
  if (!saved.ok) return { ok: false, error: "Couldn’t send that — please try again." }

  const wrote = await insertDesignMessage(db, {
    request_id: saved.id,
    author: "client",
    body: message,
  })
  // The message IS the request. Without it the artist gets a blank card and the
  // client gets an ack quoting words we never stored — so undo and say so.
  if (!wrote.ok) {
    console.error("[design] request saved without its message:", wrote.message)
    const undone = await deleteDesignRequest(db, saved.id)
    if (!undone.ok) {
      // The blank row survives and still counts toward the open-request cap, so
      // three of these would lock the client out. Loud, and don't tell them to
      // just retry — that is exactly what fills the cap.
      console.error(`[design] BLANK request ${saved.id} could not be rolled back:`, undone.message)
      return {
        ok: false,
        error: "Something went wrong saving your message — please email us instead.",
      }
    }
    return { ok: false, error: "Couldn’t send that — please try again." }
  }

  let attachedRefs = 0
  if (refKeys.length) {
    const refs = await insertDesignRefs(
      db,
      refKeys.map((key) => ({
        request_id: saved.id,
        client_id: user.id,
        storage_key: key,
      })),
    )
    // The message is the request; a lost photo must not lose it. Report what
    // actually attached, so the artist's alert never promises a photo the studio can't see.
    if (refs.ok) attachedRefs = refKeys.length
    else console.error("[design] refs not attached to", saved.id, refs.message)
  }

  await notifyOwner(db, { kind: "design_request", clientId: user.id })

  const contact = (await fetchClientContacts([user.id]))[user.id]
  const locale = contact?.communicationLocale ?? "da"
  // Client ack and artist alert are independent — send both at once.
  const [ack] = await Promise.all([
    contact?.email
      ? sendDesignRequestReceivedEmail({
          to: contact.email,
          firstName: contact.firstName,
          locale,
          message,
        })
      : Promise.resolve<EmailResult>({ ok: false, skipped: true }),
    sendDesignRequestArtistEmail({
      requestId: saved.id,
      clientName: contactDisplayName(contact),
      clientEmail: contact?.email ?? null,
      clientPhone: contact?.phone ?? null,
      topic: input.topic,
      message,
      preferredWindow,
      refCount: attachedRefs,
    }),
  ])
  if (contact?.email) {
    await recordCommunication({
      clientId: user.id,
      bookingId: null,
      kind: "design_request_received",
      trigger: "auto",
      recipient: contact.email,
      status: statusFromEmailResult(ack),
      error: ack.error,
    })
  }

  revalidatePath(routes.admin.home)
  return { ok: true, id: saved.id }
}

/** The client adds a follow-up to their own open request. */
export async function addDesignMessage(
  requestId: string,
  body: string,
): Promise<DesignActionResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "Please sign in first." }
  // The open-request cap bounds REQUESTS; nothing bounded messages, and each one
  // also inserts an owner notification and grows an unpaginated admin card.
  if (!takeToken(messages, user.id, Date.now(), MESSAGE_RULE)) {
    return { ok: false, error: "That's a lot of messages at once — give the studio a moment." }
  }
  const message = body.trim()
  if (!message) return { ok: false, error: "Write a message first." }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: "That message is too long." }
  }

  const db = createSupabaseServiceRoleClient()
  const request = await getDesignRequest(db, requestId)
  if (!request || request.client_id !== user.id) {
    return { ok: false, error: "Not found." }
  }
  // A closed thread takes no more input. The UI hides the form, but the action
  // is the boundary — otherwise a replay posts into a request the queue no
  // longer lists, and each one fires an owner notification.
  if (!isActionableDesignStatus(request.status)) {
    return { ok: false, error: "That conversation is closed — start a new one." }
  }

  const wrote = await insertDesignMessage(db, {
    request_id: requestId,
    author: "client",
    body: message,
  })
  if (!wrote.ok) return { ok: false, error: "Couldn’t send that — please try again." }

  await notifyOwner(db, { kind: "design_request", clientId: user.id })
  revalidatePath(routes.admin.home)
  return { ok: true }
}

/** Another photo on an existing request of the client's own. */
export async function addDesignRef(
  requestId: string,
  storageKey: string,
): Promise<DesignActionResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "Please sign in first." }
  if (!takeToken(messages, user.id, Date.now(), MESSAGE_RULE)) {
    return { ok: false, error: "That's a lot of messages at once — give the studio a moment." }
  }
  if (!storageKey.startsWith(REF_PREFIX)) return { ok: false, error: "Couldn’t attach that." }

  const db = createSupabaseServiceRoleClient()
  const request = await getDesignRequest(db, requestId)
  if (!request || request.client_id !== user.id) {
    return { ok: false, error: "Not found." }
  }
  if (!isActionableDesignStatus(request.status)) {
    return { ok: false, error: "That conversation is closed — start a new one." }
  }
  const existing = await countDesignRefs(db, requestId)
  if (existing >= MAX_REFS_PER_REQUEST) {
    return { ok: false, error: `Up to ${MAX_REFS_PER_REQUEST} photos, please.` }
  }

  const saved = await insertDesignRefs(db, [
    { request_id: requestId, client_id: user.id, storage_key: storageKey },
  ])
  return saved.ok ? { ok: true } : { ok: false, error: "Couldn’t attach that." }
}

/** The artist writes back without making an offer (a question, usually). */
export async function replyToDesignRequest(
  requestId: string,
  body: string,
): Promise<DesignActionResult> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "Not authorized." }
  const message = body.trim()
  if (!message) return { ok: false, error: "Write a reply first." }

  const request = await getDesignRequest(db, requestId)
  if (!request) return { ok: false, error: "Request not found." }

  const wrote = await insertDesignMessage(db, {
    request_id: requestId,
    author: "artist",
    body: message,
  })
  if (!wrote.ok) return { ok: false, error: "Couldn’t send the reply." }

  const contact = (await fetchClientContacts([request.client_id]))[request.client_id]
  if (contact?.email) {
    const res = await sendDesignReplyEmail({
      to: contact.email,
      firstName: contact.firstName,
      locale: contact.communicationLocale,
      message,
    })
    await recordCommunication({
      clientId: request.client_id,
      bookingId: null,
      kind: "design_reply",
      trigger: "manual",
      recipient: contact.email,
      status: statusFromEmailResult(res),
      error: res.error,
    })
  }

  revalidatePath(routes.admin.home)
  return { ok: true }
}

/** The artist closes a request the studio isn't taking on. */
export async function declineDesignRequest(
  requestId: string,
  reason?: string,
): Promise<DesignActionResult> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "Not authorized." }

  const request = await getDesignRequest(db, requestId)
  if (!request) return { ok: false, error: "Request not found." }

  // Close any live offer first: the signed link outlives the request, so a
  // declined request with a live offer would still book a real appointment.
  const live = await getLiveOfferForRequest(db, requestId)
  if (live) {
    const now = new Date().toISOString()
    const pulled = await updateOffer(db, live.id, {
      withdrawn_at: now,
      closed_at: now,
    })
    if (!pulled.ok) {
      return { ok: false, error: "Couldn’t withdraw the open offer — try again." }
    }
  }

  const trimmed = reason?.trim() || null
  const closed = await updateDesignRequest(db, requestId, {
    status: "declined",
    decline_reason: trimmed,
    closed_at: new Date().toISOString(),
  })
  if (!closed.ok) return { ok: false, error: "Couldn’t close it — please try again." }

  const contact = (await fetchClientContacts([request.client_id]))[request.client_id]
  if (contact?.email) {
    const res = await sendDesignRequestDeclinedEmail({
      to: contact.email,
      firstName: contact.firstName,
      locale: contact.communicationLocale,
      reason: trimmed,
    })
    await recordCommunication({
      clientId: request.client_id,
      bookingId: null,
      kind: "design_request_declined",
      trigger: "manual",
      recipient: contact.email,
      status: statusFromEmailResult(res),
      error: res.error,
    })
  }

  revalidatePath(routes.admin.home)
  return { ok: true }
}
