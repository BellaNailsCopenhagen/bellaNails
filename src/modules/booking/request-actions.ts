"use server"

import { revalidatePath } from "next/cache"

import {
  getBookingRequest,
  insertBookingRequest,
  updateBookingRequest,
} from "@/db/booking-requests"
import { insertBooking } from "@/db/bookings"
import { updateClientCommunicationLocale } from "@/db/clients"
import { takeDurableToken } from "@/db/rate-limits"
import { resolveLocale } from "@/i18n/routing"
import { buildBookingDraft } from "@/modules/booking/booking-draft"
import { manageUrlFor } from "@/modules/booking/manage-token"
import {
  callerIp,
  checkBlocked,
  getBookingProtectionSettings,
} from "@/modules/booking/protection"
import { fetchClientContacts } from "@/modules/clients"
import { ensureUser } from "@/modules/identity/ensure-user"
import {
  humanCheckConfigured,
  spendHumanProof,
  verifyHumanProof,
} from "@/modules/identity/human-check"
import { getCurrentUser } from "@/modules/identity/server"
import { requireOwner } from "@/modules/identity/require-owner"

import { sendBookingConfirmationEmail } from "@/modules/notifications/booking-email"
import {
  recordCommunication,
  statusFromEmailResult,
} from "@/modules/notifications/communications"
import {
  dismissOwnerNotifications,
  notifyOwner,
} from "@/modules/notifications/notify"
import {
  sendBookingRequestArtistEmail,
  sendBookingRequestDeclinedEmail,
  sendBookingRequestReceivedEmail,
} from "@/modules/notifications/request-email"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"
import {
  localizedBookingNames,
  metaOf,
  requestTimeProblem,
} from "@/shared/booking-policy"
import { serviceRef } from "@/shared/booking-subject"
import { BOOKING_STATUS } from "@/shared/booking-status"
import { requiresVerifiedIdentity } from "@/shared/booking-protection"
import { EMAIL_PATTERN, toE164 } from "@/shared/contact-validation"
import { routes } from "@/shared/routes"

const MIN = 60_000

// A request is cheaper for us than a booking but still costs an artist alert
// and an email, so it gets its own durable per-client window.
const REQUEST_RULE = { limit: 5, window: "1 hour" }

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
  /** Only read when "require a sign-in to book" is OFF. */
  email?: string
  phone?: string
  message?: string
  locale?: string
  honeypot?: string
  humanProof?: string
}

/**
 * A client asks for a slot the self-service flow won't grant (outside hours, or
 * past the 2-active cap). Builds the same as-booked snapshot as a booking but
 * WITHOUT a slot check, records the request, alerts the artist in-app, and
 * emails the client a clear "received, not yet confirmed" acknowledgement.
 *
 * Gated exactly like `createBooking`: this path writes a client row, an artist
 * notification and two emails, so leaving it open to an unverified address
 * would have been the hole the booking gate was closing.
 */
export async function createBookingRequest(
  input: CreateRequestInput,
): Promise<
  | { ok: true; id: string }
  | { ok: false; error: string; code?: "auth" | "human" }
> {
  if (input.honeypot?.trim()) return { ok: false, error: "Couldn't send the request." }

  const db = createSupabaseServiceRoleClient()

  // The same artist-controlled protection as createBooking — this path writes a
  // client row, an artist alert and two emails, so leaving it ungated would be
  // the hole the booking gate closes.
  const protection = await getBookingProtectionSettings(db)

  // Her switch AND a signing secret — see createBooking.
  const humanCheckOn = protection.humanCheck && humanCheckConfigured()
  if (humanCheckOn) {
    const human = await verifyHumanProof(input.humanProof)
    if (!human.ok) {
      return {
        ok: false,
        code: "human",
        error:
          human.reason === "missing"
            ? "Please tick the “I'm not a robot” box first."
            : "That check didn't pass — tick the box again and retry.",
      }
    }
  }

  // `code: "auth"` ONLY for a missing session — see createBooking.
  const user = await getCurrentUser()
  if (requiresVerifiedIdentity(protection.accessLevel) && !user) {
    return {
      ok: false,
      code: "auth",
      error: "Please sign in to send a request — it confirms your email.",
    }
  }
  const email = (user?.email ?? input.email ?? "").trim().toLowerCase()
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return {
      ok: false,
      error: user
        ? "Your account has no email address we can reply to — please contact the studio."
        : "Enter a valid email.",
    }
  }

  // The slot check is off for a request, so this is the only bound on the time.
  const when = requestTimeProblem(input.start, Date.now())
  if (when === "tooFar") {
    return { ok: false, error: "That's too far ahead — pick a nearer date." }
  }
  if (when) return { ok: false, error: "Pick a time in the future." }

  const ip = await callerIp()
  const blocked = await checkBlocked(db, { email, ip })
  if (blocked.blocked) {
    return { ok: false, error: "We can't take this request online — please contact the studio." }
  }

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

  // Last thing before the write, so a rejected time costs no quota. Keyed on
  // the connection too when there is no session — see createBooking.
  const buckets = [`booking:request:${clientId}`]
  if (!user && ip) buckets.push(`booking:request:ip:${ip}`)
  for (const bucket of buckets) {
    if (!(await takeDurableToken(db, bucket, REQUEST_RULE))) {
      return {
        ok: false,
        error: "That's a lot of requests in a short time — please contact the studio.",
      }
    }
  }

  // Spent late, so a rejected time doesn't burn it — see createBooking.
  if (humanCheckOn) {
    const spent = await spendHumanProof(db, input.humanProof)
    if (!spent.ok) {
      return {
        ok: false,
        code: "human",
        error: "That check has expired — tick the box again and retry.",
      }
    }
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
  // Remember the site locale, exactly as createBooking does. Without it this
  // path used the browsing locale while ACCEPT used the stored one, so a
  // request made in Danish was acknowledged in Danish and confirmed in English
  // — one client, one conversation, two languages. Best-effort: a pre-migration
  // missing column must never fail the request.
  try {
    await updateClientCommunicationLocale(db, clientId, locale)
  } catch {
    /* the request stands regardless */
  }

  // In-app alert for the artist (best-effort). Push lands with Feature C.
  await notifyOwner(db, {
    kind: "booking_request",
    clientId,
    targetId: saved.id,
  })

  // The stored name, not the one typed at step 02. `ensureUser` deliberately
  // does not overwrite an existing client's name (a checkout typo must not
  // rename them), so greeting with the typed one made the ack say "Hej QA"
  // while the admin card and the confirmation used their real name. The name
  // they type is either the record or ignored — it cannot be both.
  const contact = (await fetchClientContacts([clientId]))[clientId]

  const { serviceName, addonNames } = localizedBookingNames(
    metaOf({ selected_addons: draft.values.selected_addons }),
    locale,
  )
  // Client ack + artist alert are independent — send both in parallel (the
  // artist email needs a timely human decision; an in-app alert is easy to miss).
  const [res] = await Promise.all([
    sendBookingRequestReceivedEmail({
      to: email,
      firstName: contact?.firstName ?? null,
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
      // Their address is more use to her than "Client" when we have no name.
      clientName: contact?.firstName || contact?.fullName || email,
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
  // Only "does it parse" used to be checked here, so an Adjust-time sheet left
  // open overnight could book into the past — the overlap constraint was the
  // only thing standing in the way. Same rule the request came in under.
  const when = requestTimeProblem(startIso, Date.now())
  if (when === "past") {
    return { ok: false, error: "That time has passed — pick a new one." }
  }
  if (when === "tooFar") {
    return { ok: false, error: "That's too far ahead — pick a nearer date." }
  }
  if (when) return { ok: false, error: "Pick a valid time." }
  const startMs = new Date(startIso).getTime()
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
  } else {
    // Decided, so it is no longer a question — clear the artist's alert or it
    // sits in NEEDS YOU forever, linking to a request that no longer renders.
    await dismissOwnerNotifications(db, {
      kind: "booking_request",
      targetId: requestId,
    })
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
  revalidatePath(routes.admin.notifications)
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

  const flipped = await updateBookingRequest(db, requestId, {
    status: "rejected",
    reject_reason: reason?.trim() || null,
    decided_at: new Date().toISOString(),
  })
  // The decline email is irreversible and the queue is not: tell her it failed
  // and leave the request pending, rather than telling the client no about a
  // request that still looks undecided to the studio.
  if (!flipped.ok) {
    console.error(
      `[booking-request] request ${requestId} not marked rejected:`,
      flipped.message,
    )
    return { ok: false, error: "Couldn’t decline the request — please try again." }
  }

  // Decided, so it has stopped being a question.
  await dismissOwnerNotifications(db, {
    kind: "booking_request",
    targetId: requestId,
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
  revalidatePath(routes.admin.notifications)
  return { ok: true }
}
