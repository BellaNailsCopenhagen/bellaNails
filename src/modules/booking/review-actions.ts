"use server"

import { getBookingOwner } from "@/db/bookings"
import { fetchClientContacts } from "@/modules/clients/contacts"
import { requireOwner } from "@/modules/identity/require-owner"
import {
  recordCommunication,
  statusFromEmailResult,
} from "@/modules/notifications/communications"
import { BOOKING_FROM_EMAIL, STUDIO_EMAIL, STUDIO_NAME } from "@/config/studio"
import { sendEmail } from "@/platform/email/client"

/**
 * Admin-triggered "ask for a review" — emails the client our external review
 * link (Google) and logs it. Env-gated: with GOOGLE_REVIEW_URL unset the button
 * reports it's not configured rather than sending a broken link, so it lights up
 * the moment the studio has a Google Business profile. On-site reviews stay a
 * separate, studio-entered path.
 */
export type ReviewRequestResult = { ok: true; note?: string } | { ok: false; error: string }

export async function requestReview(bookingId: string): Promise<ReviewRequestResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const url = process.env.GOOGLE_REVIEW_URL
  if (!url) return { ok: false, error: "Review link isn’t set up yet." }

  const booking = await getBookingOwner(supabase, bookingId)
  if (!booking) return { ok: false, error: "Booking not found." }

  const contact = (await fetchClientContacts([booking.client_id]))[booking.client_id]
  if (!contact?.email) return { ok: false, error: "No email on file." }

  const isEn = contact.communicationLocale === "en"
  const greeting = contact.firstName
    ? isEn
      ? `Hi ${contact.firstName},`
      : `Hej ${contact.firstName},`
    : isEn
      ? "Hi,"
      : "Hej,"
  const line = isEn
    ? `Thank you for visiting ${STUDIO_NAME}. If you enjoyed it, a quick review would mean a lot:`
    : `Tak fordi du besøgte ${STUDIO_NAME}. Hvis du var glad for det, vil en hurtig anmeldelse betyde meget:`
  const cta = isEn ? "Leave a review" : "Skriv en anmeldelse"

  const res = await sendEmail({
    from: BOOKING_FROM_EMAIL,
    replyTo: STUDIO_EMAIL,
    to: contact.email,
    subject: isEn
      ? `How was your visit to ${STUDIO_NAME}?`
      : `Hvordan var dit besøg hos ${STUDIO_NAME}?`,
    html: `<p>${greeting}</p><p>${line}</p><p><a href="${url}">${cta}</a></p>`,
    text: `${greeting}\n\n${line}\n${cta}: ${url}`,
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

  if (res.ok) return { ok: true }
  if (res.skipped) return { ok: true, note: "Email isn’t configured — nothing sent." }
  return { ok: false, error: "Couldn’t send the email." }
}
