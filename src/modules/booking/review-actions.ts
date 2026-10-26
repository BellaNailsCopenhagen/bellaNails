"use server"

import { getBookingOwner } from "@/db/bookings"
import { fetchClientContacts } from "@/modules/clients/contacts"
import { requireOwner } from "@/modules/identity/require-owner"
import {
  recordCommunication,
  statusFromEmailResult,
} from "@/modules/notifications/communications"
import { sendReviewRequestEmail } from "@/modules/notifications/review-email"
import { reviewUrl } from "@/modules/booking/review-link"
import { canRequestReview } from "@/shared/booking-policy"

/**
 * Admin-triggered "ask for a review" — emails the client the studio's external
 * review link (Google) and logs it. Env-gated: with GOOGLE_REVIEW_URL unset
 * there is nothing to send, so the action refuses and the card renders the
 * control as unavailable rather than as a button. On-site reviews stay a
 * separate, studio-entered path.
 */
export type ReviewRequestResult =
  { ok: true; note?: string } | { ok: false; error: string }

export async function requestReview(
  bookingId: string,
): Promise<ReviewRequestResult> {
  const supabase = await requireOwner()
  if (!supabase) {
    return { ok: false, error: "unauthorized" }
  }

  const url = reviewUrl()
  if (!url) {
    return { ok: false, error: "Review link isn’t set up yet." }
  }

  const booking = await getBookingOwner(supabase, bookingId)
  if (!booking) {
    return { ok: false, error: "Booking not found." }
  }

  // The card only offers this from 30 min before the end, but a card is not a
  // guard — re-apply the rule here so it holds for any caller.
  if (!canRequestReview(booking, Date.now())) {
    return {
      ok: false,
      error:
        "Too early to ask for a review — wait until the appointment is nearly done.",
    }
  }

  const contact = (await fetchClientContacts([booking.client_id]))[
    booking.client_id
  ]
  if (!contact?.email) {
    return { ok: false, error: "No email on file." }
  }

  const res = await sendReviewRequestEmail({
    to: contact.email,
    firstName: contact.firstName,
    locale: contact.communicationLocale,
    reviewUrl: url,
  })

  await recordCommunication({
    clientId: booking.client_id,
    bookingId,
    kind: "review_request",
    trigger: "manual",
    recipient: contact.email,
    status: statusFromEmailResult(res),
    error: res.error,
  })

  if (res.ok) {
    return { ok: true }
  }
  if (res.skipped) {
    return { ok: true, note: "Email isn’t configured — nothing sent." }
  }

  return { ok: false, error: "Couldn’t send the email." }
}
