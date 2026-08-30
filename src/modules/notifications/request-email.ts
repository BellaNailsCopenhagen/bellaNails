import "server-only"

import { BRAND } from "@/config/brand"
import { BOOKING_FROM_EMAIL, STUDIO_EMAIL, STUDIO_NAME } from "@/config/studio"
import { sendEmail, type EmailResult } from "@/platform/email/client"
import { formatPrice } from "@/shared/money"
import { formatStudioDate, formatStudioTime } from "@/shared/studio-time"

/**
 * Booking-REQUEST emails — deliberately distinct from a booking confirmation so a
 * client is never misled: a request is "we'd like this time", not a confirmed
 * appointment. `received` acknowledges the ask (with all the details) and makes
 * the not-yet-confirmed status unmistakable; `declined` closes it kindly. An
 * ACCEPTED request sends the normal confirmation instead (a real booking exists).
 */

const FONT = "Georgia, 'Times New Roman', serif"

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export type RequestKind = "outside_hours" | "over_limit"

type ReceivedDetail = {
  to: string
  firstName: string | null
  locale: string
  kind: RequestKind
  serviceName: string
  addonNames: string[]
  startIso: string
  priceCents: number
  message?: string | null
}

type DeclinedDetail = {
  to: string
  firstName: string | null
  locale: string
  serviceName: string
  reason?: string | null
}

function shell(opts: {
  eyebrow: string
  heading: string
  greeting: string
  bodyHtml: string
}): string {
  return `<div style="background:${BRAND.background};margin:0;padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;font-family:${FONT};color:${BRAND.textPrimary};">
      <tr><td style="padding:8px 8px 20px;text-align:center;">
        <span style="font-size:22px;letter-spacing:0.14em;color:${BRAND.cta};">${esc(STUDIO_NAME)}</span>
      </td></tr>
      <tr><td style="padding:0 8px;">
        <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND.textSecondary};">${esc(opts.eyebrow)}</p>
        <p style="margin:0 0 16px;font-size:20px;color:${BRAND.textPrimary};">${esc(opts.heading)}</p>
        <p style="margin:0 0 12px;font-size:15px;">${esc(opts.greeting)}</p>
        ${opts.bodyHtml}
      </td></tr>
    </table>
  </td></tr></table>
</div>`
}

const greetOf = (firstName: string | null, isEn: boolean) =>
  firstName
    ? isEn
      ? `Hi ${firstName},`
      : `Hej ${firstName},`
    : isEn
      ? "Hi,"
      : "Hej,"

export async function sendBookingRequestReceivedEmail(
  d: ReceivedDetail,
): Promise<EmailResult> {
  try {
    const isEn = d.locale === "en"
    const when = `${formatStudioDate(d.startIso, d.locale)} · ${formatStudioTime(d.startIso, d.locale)}`
    const addons = d.addonNames.length ? d.addonNames.join(", ") : null

    const reason =
      d.kind === "outside_hours"
        ? isEn
          ? "You've asked to book a time outside our normal working hours."
          : "Du har bedt om en tid uden for vores normale åbningstid."
        : isEn
          ? "You've asked to book beyond the maximum of 2 active bookings."
          : "Du har bedt om en booking ud over det maksimale antal aktive bookinger (2)."
    const confirmation = isEn
      ? "We've received your request — we'll review it and get back to you to confirm a time. This is not a booking confirmation."
      : "Vi har modtaget din anmodning — vi gennemgår den og vender tilbage for at bekræfte et tidspunkt. Dette er ikke en bookingbekræftelse."
    const rows: [string, string][] = [
      [isEn ? "Service" : "Behandling", d.serviceName],
      ...(addons ? ([[isEn ? "Add-ons" : "Tillæg", addons]] as [string, string][]) : []),
      [isEn ? "Requested time" : "Ønsket tid", when],
      [isEn ? "Estimated price" : "Anslået pris", formatPrice(d.priceCents)],
    ]
    const rowsHtml = rows
      .map(
        ([l, v]) =>
          `<tr><td style="padding:6px 0;font-size:14px;color:${BRAND.textSecondary};width:40%;">${esc(l)}</td><td style="padding:6px 0;font-size:14px;color:${BRAND.textPrimary};">${esc(v)}</td></tr>`,
      )
      .join("")
    const noteHtml = d.message
      ? `<p style="margin:12px 0;font-size:14px;color:${BRAND.textSecondary};">${esc(isEn ? "Your note" : "Din besked")}: ${esc(d.message)}</p>`
      : ""

    const bodyHtml = `<p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${BRAND.textPrimary};">${esc(reason)}</p>
<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${BRAND.textSecondary};">${esc(confirmation)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rowsHtml}</table>
${noteHtml}
<p style="margin:16px 0 0;font-size:13px;color:${BRAND.textSecondary};">${esc(isEn ? "Questions? Just reply to this email." : "Spørgsmål? Svar blot på denne e-mail.")}</p>`

    const text = [
      STUDIO_NAME,
      "",
      isEn ? "BOOKING REQUEST RECEIVED" : "BOOKING-ANMODNING MODTAGET",
      "",
      greetOf(d.firstName, isEn),
      "",
      reason,
      confirmation,
      "",
      ...rows.map(([l, v]) => `${l}: ${v}`),
      d.message ? `\n${isEn ? "Your note" : "Din besked"}: ${d.message}` : "",
    ].join("\n")

    return await sendEmail({
      from: BOOKING_FROM_EMAIL,
      replyTo: STUDIO_EMAIL,
      to: d.to,
      subject: isEn
        ? `We've received your booking request`
        : `Vi har modtaget din booking-anmodning`,
      html: shell({
        eyebrow: isEn ? "Booking request" : "Booking-anmodning",
        heading: isEn ? "Request received" : "Anmodning modtaget",
        greeting: greetOf(d.firstName, isEn),
        bodyHtml,
      }),
      text,
    })
  } catch (error) {
    console.error("[request-email] received failed —", error instanceof Error ? error.message : error)
    return { ok: false, error: error instanceof Error ? error.name : "send_error" }
  }
}

type ArtistDetail = {
  requestId: string
  clientName: string
  clientEmail: string | null
  clientPhone: string | null
  kind: RequestKind
  serviceName: string
  startIso: string
  message?: string | null
}

const ADMIN_URL = process.env.NEXT_PUBLIC_SITE_URL
  ? `${process.env.NEXT_PUBLIC_SITE_URL}/admin`
  : null

/**
 * The ARTIST's alert for a new booking request — email, not just the in-app
 * notification, because a request needs a timely human decision. English (admin
 * language); replyTo is the client so the artist can answer them directly.
 */
export async function sendBookingRequestArtistEmail(
  d: ArtistDetail,
): Promise<EmailResult> {
  try {
    const when = `${formatStudioDate(d.startIso, "en")} · ${formatStudioTime(d.startIso, "en")}`
    const rows: [string, string][] = [
      ["Client", d.clientName],
      ...(d.clientPhone ? ([["Phone", d.clientPhone]] as [string, string][]) : []),
      ...(d.clientEmail ? ([["Email", d.clientEmail]] as [string, string][]) : []),
      ["Service", d.serviceName],
      ["Requested", when],
      [
        "Type",
        d.kind === "outside_hours"
          ? "Outside working hours"
          : "Over the 2-booking limit",
      ],
    ]
    const rowsHtml = rows
      .map(
        ([l, v]) =>
          `<tr><td style="padding:6px 0;font-size:14px;color:${BRAND.textSecondary};width:35%;">${esc(l)}</td><td style="padding:6px 0;font-size:14px;color:${BRAND.textPrimary};">${esc(v)}</td></tr>`,
      )
      .join("")
    const noteHtml = d.message
      ? `<p style="margin:12px 0;font-size:14px;color:${BRAND.textSecondary};">Client note: ${esc(d.message)}</p>`
      : ""
    // Deep-links to this request's card on the admin home (#request-<id>); if the
    // artist has the admin PWA installed, the OS opens it there.
    const reviewUrl = ADMIN_URL ? `${ADMIN_URL}#request-${d.requestId}` : null
    const linkHtml = reviewUrl
      ? `<p style="margin:16px 0 0;"><a href="${esc(reviewUrl)}" style="color:${BRAND.cta};">Review this request →</a></p>`
      : `<p style="margin:16px 0 0;font-size:13px;color:${BRAND.textSecondary};">Review it in the admin — Requests on the home.</p>`

    const bodyHtml = `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${BRAND.textSecondary};">A client has sent a booking request that needs your review.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rowsHtml}</table>
${noteHtml}${linkHtml}`

    const text = [
      STUDIO_NAME,
      "",
      "NEW BOOKING REQUEST — needs your review",
      "",
      ...rows.map(([l, v]) => `${l}: ${v}`),
      d.message ? `\nClient note: ${d.message}` : "",
      "",
      reviewUrl ? `Review: ${reviewUrl}` : "Review it in the admin — Requests on the home.",
    ].join("\n")

    return await sendEmail({
      from: BOOKING_FROM_EMAIL,
      // Artist can reply straight to the client.
      replyTo: d.clientEmail ?? STUDIO_EMAIL,
      to: STUDIO_EMAIL,
      subject: `New booking request — ${d.clientName}`,
      html: shell({
        eyebrow: "Booking request",
        heading: "New request to review",
        greeting: "Hi,",
        bodyHtml,
      }),
      text,
    })
  } catch (error) {
    console.error(
      "[request-email] artist alert failed —",
      error instanceof Error ? error.message : error,
    )
    return { ok: false, error: error instanceof Error ? error.name : "send_error" }
  }
}

export async function sendBookingRequestDeclinedEmail(
  d: DeclinedDetail,
): Promise<EmailResult> {
  try {
    const isEn = d.locale === "en"
    const reasonHtml = d.reason
      ? `<p style="margin:0 0 12px;font-size:14px;color:${BRAND.textSecondary};">${esc(isEn ? "Note from the studio" : "Besked fra salonen")}: ${esc(d.reason)}</p>`
      : ""
    const bodyHtml = `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${BRAND.textSecondary};">${esc(
      isEn
        ? `Thank you for your request for ${d.serviceName}. Unfortunately we can't accommodate this one — but you're very welcome to book an available time on our site anytime.`
        : `Tak for din anmodning om ${d.serviceName}. Desværre kan vi ikke imødekomme denne — men du er meget velkommen til at booke en ledig tid på vores side når som helst.`,
    )}</p>${reasonHtml}<p style="margin:16px 0 0;font-size:13px;color:${BRAND.textSecondary};">${esc(isEn ? "Questions? Just reply to this email." : "Spørgsmål? Svar blot på denne e-mail.")}</p>`

    const text = [
      STUDIO_NAME,
      "",
      greetOf(d.firstName, isEn),
      "",
      isEn
        ? `Thank you for your request for ${d.serviceName}. Unfortunately we can't accommodate this one — you're welcome to book an available time on our site anytime.`
        : `Tak for din anmodning om ${d.serviceName}. Desværre kan vi ikke imødekomme denne — du er velkommen til at booke en ledig tid på vores side.`,
      d.reason ? `\n${isEn ? "Note" : "Besked"}: ${d.reason}` : "",
    ].join("\n")

    return await sendEmail({
      from: BOOKING_FROM_EMAIL,
      replyTo: STUDIO_EMAIL,
      to: d.to,
      subject: isEn
        ? `About your booking request`
        : `Om din booking-anmodning`,
      html: shell({
        eyebrow: isEn ? "Booking request" : "Booking-anmodning",
        heading: isEn ? "Request update" : "Opdatering",
        greeting: greetOf(d.firstName, isEn),
        bodyHtml,
      }),
      text,
    })
  } catch (error) {
    console.error("[request-email] declined failed —", error instanceof Error ? error.message : error)
    return { ok: false, error: error instanceof Error ? error.name : "send_error" }
  }
}
