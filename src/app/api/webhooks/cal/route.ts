import { createHmac, timingSafeEqual } from "node:crypto"

import { BOOKING_STATUS, type BookingStatus } from "@/shared/booking-status"
import {
  markBookingCancelledFromCal,
  persistCalBooking,
} from "@/modules/booking"
import { calBookingPhone } from "@/platform/cal/parse-phone"

/**
 * Cal.com webhook (EU instance) — the push half of the booking mirror (see
 * lib/booking-sync.ts for the architecture). HMAC-verified before the body
 * is trusted. BOOKING_CANCELLED updates by id; a zero-row match returns 500
 * so Cal retries (heals out-of-order delivery).
 */

/** Cal's standard (non-custom-template) payload — only the fields we read. */
type CalWebhookEvent = {
  triggerEvent: string
  payload: {
    bookingId?: number
    uid?: string
    /** On BOOKING_RESCHEDULED: the uid of the ORIGINAL (replaced) booking. */
    rescheduleUid?: string
    startTime?: string
    endTime?: string
    attendees?: {
      email?: string
      name?: string
      phoneNumber?: string
    }[]
    responses?: {
      attendeePhoneNumber?: { value?: string }
    }
    metadata?: Record<string, unknown>
  }
}

function verifySignature(
  secret: string,
  rawBody: string,
  header: string | null,
) {
  if (!header) return false
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex")
  const a = Buffer.from(expected, "utf8")
  const b = Buffer.from(header, "utf8")
  return a.length === b.length && timingSafeEqual(a, b)
}

function persistFailed(context: string, message: string) {
  console.error(`[cal-webhook] ${context}: ${message}`)
  // 5xx → Cal retries; every write here is idempotent.
  return new Response("Persist failed", { status: 500 })
}

export async function POST(request: Request) {
  const secret = process.env.CALCOM_WEBHOOK_SECRET
  if (!secret) {
    return new Response("Webhook secret not configured", { status: 500 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get("x-cal-signature-256")
  if (!verifySignature(secret, rawBody, signature)) {
    return new Response("Invalid signature", { status: 401 })
  }

  let event: CalWebhookEvent
  try {
    event = JSON.parse(rawBody) as CalWebhookEvent
  } catch {
    return new Response("Malformed JSON", { status: 400 })
  }

  // Receipt log — Cal's UI has no delivery history; this is the only
  // record of delivery timing.
  console.log("[cal-webhook] received", {
    triggerEvent: event.triggerEvent,
    bookingId: event.payload?.bookingId,
    uid: event.payload?.uid,
  })

  switch (event.triggerEvent) {
    case "BOOKING_CREATED":
      return handleBooking(event.payload, BOOKING_STATUS.confirmed)
    case "BOOKING_RESCHEDULED":
      return handleBooking(event.payload, BOOKING_STATUS.rescheduled)
    case "BOOKING_CANCELLED":
      return markCancelled(event.payload)
    default:
      // Unsubscribed/unknown trigger — acknowledge so Cal doesn't retry.
      return Response.json({ ignored: event.triggerEvent })
  }
}

/** Map the webhook payload onto the shared persist routine. */
async function handleBooking(
  payload: CalWebhookEvent["payload"],
  status: BookingStatus,
) {
  const { bookingId, uid, startTime, endTime } = payload
  const attendee = payload.attendees?.[0]

  if (!bookingId || !uid || !startTime || !endTime || !attendee?.email) {
    // Not retryable — acknowledge and surface in logs instead of 4xx-ing,
    // so Cal doesn't hammer us over a payload shape we'll never accept.
    console.error("[cal-webhook] booking payload missing fields", {
      status,
      bookingId,
      uid,
      hasAttendee: Boolean(attendee?.email),
    })
    return Response.json({ skipped: "missing fields" })
  }

  const result = await persistCalBooking({
    bookingId,
    uid,
    startTime,
    endTime,
    attendeeEmail: attendee.email,
    attendeeName: attendee.name,
    attendeePhone: calBookingPhone(payload),
    rescheduleUid: payload.rescheduleUid ?? null,
    metadata: payload.metadata ?? {},
    status,
  })

  if (!result.ok) return persistFailed("persist failed", result.message)
  return Response.json({ ok: true })
}

async function markCancelled(payload: CalWebhookEvent["payload"]) {
  if (!payload.bookingId) {
    console.error("[cal-webhook] BOOKING_CANCELLED without bookingId")
    return Response.json({ skipped: "missing bookingId" })
  }

  const cancelled = await markBookingCancelledFromCal(payload.bookingId)

  if (!cancelled.ok) {
    return persistFailed("bookings cancel failed", cancelled.message)
  }
  if (cancelled.matched === 0) {
    // No row yet — deliveries can arrive out of order. 5xx so Cal retries
    // once the booking upsert has landed.
    return persistFailed(
      "bookings cancel matched no row",
      `cal_booking_id=${payload.bookingId}`,
    )
  }
  return Response.json({ ok: true })
}
