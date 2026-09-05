import "server-only"

import { BRAND } from "@/config/brand"
import { STUDIO_NAME } from "@/config/studio"
import {
  buttonHtml,
  esc,
  greetOf,
  para,
  quote,
  shell,
} from "@/modules/notifications/email-layout"
import { mailFrom, businessInbox } from "@/modules/notifications/sender"
import { sendEmail, type EmailResult } from "@/platform/email/client"
import { formatPrice } from "@/shared/money"
import { formatStudioDayMonthYear } from "@/shared/studio-time"

/**
 * Design-request emails. Four moments, deliberately distinct so a client is
 * never misled about what they have:
 *
 *   received  — "we have your message" (explicitly NOT a booking)
 *   replied   — the client wrote back, so the artist is emailed too
 *   reply     — the artist wrote back with a question, still no offer
 *   offer     — a price and a length, with the link that books it
 *   declined  — closed, kindly
 *
 * Booking the offer sends the normal confirmation instead: at that point a real
 * appointment exists and the booking emails own it.
 */

const ADMIN_URL = process.env.NEXT_PUBLIC_SITE_URL
  ? `${process.env.NEXT_PUBLIC_SITE_URL}/admin`
  : null

type Base = { to: string; firstName: string | null; locale: string }

// ─────────────────────────────────────────────── received
export async function sendDesignRequestReceivedEmail(
  d: Base & { message: string },
): Promise<EmailResult> {
  const isEn = d.locale === "en"
  const eyebrow = isEn ? "Message received" : "Besked modtaget"
  const heading = isEn
    ? "Thank you — we have your message"
    : "Tak — vi har din besked"
  const intro = isEn
    ? "We'll come back to you with a price and how long it takes, usually within a day."
    : "Vi vender tilbage med en pris og hvor lang tid det tager, typisk inden for en dag."
  const notYet = isEn
    ? "This is not a booking yet — nothing is reserved until you choose a time from the offer we send."
    : "Det er ikke en booking endnu — der er ikke reserveret noget, før du vælger et tidspunkt i det tilbud, vi sender."

  return send({
    to: d.to,
    subject: isEn
      ? `${STUDIO_NAME} — we have your message`
      : `${STUDIO_NAME} — vi har din besked`,
    html: shell({
      eyebrow,
      heading,
      greeting: greetOf(d.firstName, isEn),
      bodyHtml: `${para(intro)}${quote(d.message)}${para(notYet)}`,
    }),
    text: lines([
      STUDIO_NAME,
      heading,
      "",
      greetOf(d.firstName, isEn),
      intro,
      "",
      `"${d.message}"`,
      "",
      notYet,
    ]),
  })
}

// ─────────────────────────────────────────────── artist alert
export async function sendDesignRequestArtistEmail(d: {
  requestId: string
  clientName: string
  clientEmail: string | null
  clientPhone: string | null
  topic: string
  message: string
  preferredWindow: string | null
  refCount: number
}): Promise<EmailResult> {
  const rows: [string, string][] = [
    ["Client", d.clientName],
    ...(d.clientPhone ? ([["Phone", d.clientPhone]] as [string, string][]) : []),
    ...(d.clientEmail ? ([["Email", d.clientEmail]] as [string, string][]) : []),
    ["About", TOPIC_LABEL[d.topic] ?? d.topic],
    ...(d.preferredWindow
      ? ([["Wants it", d.preferredWindow]] as [string, string][])
      : []),
    ["Photos", String(d.refCount)],
  ]
  const reviewUrl = ADMIN_URL ? `${ADMIN_URL}#design-${d.requestId}` : null

  return send({
    to: await businessInbox(),
    replyTo: d.clientEmail ?? undefined,
    subject: `New design request — ${d.clientName}`,
    html: shell({
      eyebrow: "Needs you",
      heading: "A client has written in",
      greeting: "",
      bodyHtml: `${rowsHtml(rows)}${quote(d.message)}${
        reviewUrl
          ? `<p style="margin:16px 0 0;"><a href="${esc(reviewUrl)}" style="color:${BRAND.cta};">Open this request →</a></p>`
          : para("Open it in the admin — the request is on your home screen.")
      }`,
    }),
    text: lines([
      STUDIO_NAME,
      "A client has written in",
      "",
      ...rows.map(([l, v]) => `${l}: ${v}`),
      "",
      `"${d.message}"`,
      ...(reviewUrl ? ["", reviewUrl] : []),
    ]),
  })
}

// ─────────────────────────────────────────────── artist alert: they wrote back
export async function sendDesignClientReplyArtistEmail(d: {
  requestId: string
  clientName: string
  clientEmail: string | null
  message: string
}): Promise<EmailResult> {
  const reviewUrl = ADMIN_URL ? `${ADMIN_URL}#design-${d.requestId}` : null

  return send({
    to: await businessInbox(),
    replyTo: d.clientEmail ?? undefined,
    subject: `Reply on a design request — ${d.clientName}`,
    html: shell({
      eyebrow: "Needs you",
      heading: `${d.clientName} wrote back`,
      greeting: "",
      bodyHtml: `${quote(d.message)}${
        reviewUrl
          ? `<p style="margin:16px 0 0;"><a href="${esc(reviewUrl)}" style="color:${BRAND.cta};">Open the thread →</a></p>`
          : para("Open it in the admin — the thread is on your home screen.")
      }`,
    }),
    text: lines([
      STUDIO_NAME,
      `${d.clientName} wrote back`,
      "",
      `"${d.message}"`,
      ...(reviewUrl ? ["", reviewUrl] : []),
    ]),
  })
}

// ─────────────────────────────────────────────── artist reply (no offer yet)
export async function sendDesignReplyEmail(
  d: Base & { message: string },
): Promise<EmailResult> {
  const isEn = d.locale === "en"
  const heading = isEn ? "We've replied" : "Vi har svaret"
  const intro = isEn
    ? "Reply to this email and we'll pick it up."
    : "Svar på denne e-mail, så tager vi den derfra."

  return send({
    to: d.to,
    subject: isEn
      ? `${STUDIO_NAME} — a reply about your design`
      : `${STUDIO_NAME} — svar om dit design`,
    html: shell({
      eyebrow: isEn ? "Reply" : "Svar",
      heading,
      greeting: greetOf(d.firstName, isEn),
      bodyHtml: `${quote(d.message)}${para(intro)}`,
    }),
    text: lines([
      STUDIO_NAME,
      heading,
      "",
      greetOf(d.firstName, isEn),
      `"${d.message}"`,
      "",
      intro,
    ]),
  })
}

// ─────────────────────────────────────────────── the offer
export async function sendOfferEmail(
  d: Base & {
    offerName: string
    durationMins: number
    priceCents: number
    artistNote: string | null
    expiresAt: string
    offerUrl?: string
  },
): Promise<EmailResult> {
  const isEn = d.locale === "en"
  const heading = isEn
    ? "A time and a price for you"
    : "En tid og en pris til dig"
  const summary = `${d.durationMins} ${isEn ? "minutes" : "minutter"} · ${formatPrice(
    d.priceCents,
    d.locale,
  )}`
  // Studio time, like the offer page — otherwise a late-evening offer shows a
  // different day in the email than on the page it links to.
  const until = formatStudioDayMonthYear(Date.parse(d.expiresAt), d.locale)
  const holds = isEn
    ? `This offer holds until ${until}.`
    : `Tilbuddet gælder til ${until}.`
  const yours = isEn
    ? "It's yours alone — the link only works for you."
    : "Det er kun til dig — linket virker kun for dig."
  const cta = isEn ? "Choose your time" : "Vælg din tid"

  return send({
    to: d.to,
    subject: isEn
      ? `${STUDIO_NAME} — your offer`
      : `${STUDIO_NAME} — dit tilbud`,
    html: shell({
      eyebrow: isEn ? "Your offer" : "Dit tilbud",
      heading,
      greeting: greetOf(d.firstName, isEn),
      bodyHtml: [
        `<p style="margin:0 0 4px;font-size:17px;color:${BRAND.textPrimary};">${esc(d.offerName)}</p>`,
        `<p style="margin:0 0 18px;font-size:15px;color:${BRAND.textSecondary};">${esc(summary)}</p>`,
        d.artistNote ? quote(d.artistNote) : "",
        d.offerUrl ? buttonHtml(d.offerUrl, cta) : "",
        para(holds),
        para(yours),
      ].join(""),
    }),
    text: lines([
      STUDIO_NAME,
      heading,
      "",
      greetOf(d.firstName, isEn),
      d.offerName,
      summary,
      ...(d.artistNote ? ["", `"${d.artistNote}"`] : []),
      ...(d.offerUrl ? ["", `${cta}: ${d.offerUrl}`] : []),
      "",
      holds,
      yours,
    ]),
  })
}

// ─────────────────────────────────────────────── declined
export async function sendDesignRequestDeclinedEmail(
  d: Base & { reason: string | null },
): Promise<EmailResult> {
  const isEn = d.locale === "en"
  const heading = isEn
    ? "About your message"
    : "Om din besked"
  const intro = isEn
    ? "We aren't able to take this one on."
    : "Vi kan desværre ikke tage denne opgave."
  const invite = isEn
    ? "You're always welcome to write again with something else in mind."
    : "Du er altid velkommen til at skrive igen med noget andet i tankerne."

  return send({
    to: d.to,
    subject: isEn
      ? `${STUDIO_NAME} — about your message`
      : `${STUDIO_NAME} — om din besked`,
    html: shell({
      eyebrow: isEn ? "Message" : "Besked",
      heading,
      greeting: greetOf(d.firstName, isEn),
      bodyHtml: `${para(intro)}${d.reason ? quote(d.reason) : ""}${para(invite)}`,
    }),
    text: lines([
      STUDIO_NAME,
      heading,
      "",
      greetOf(d.firstName, isEn),
      intro,
      ...(d.reason ? ["", `"${d.reason}"`] : []),
      "",
      invite,
    ]),
  })
}

// ─────────────────────────────────────────────── helpers

const TOPIC_LABEL: Record<string, string> = {
  new_design: "A design they've seen",
  repair: "A repair or fix",
  other: "Something else",
}

function rowsHtml(rows: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px;">${rows
    .map(
      ([l, v]) =>
        `<tr><td style="padding:6px 0;font-size:14px;color:${BRAND.textSecondary};width:35%;">${esc(l)}</td><td style="padding:6px 0;font-size:14px;color:${BRAND.textPrimary};">${esc(v)}</td></tr>`,
    )
    .join("")}</table>`
}

const lines = (parts: string[]) => parts.join("\n")

/** One send path, so every design email gets the same from/reply-to treatment
    and the same swallow-and-report failure contract.

    Sends as the studio's CONTACT address, not the bookings alias: these are a
    conversation, and a reply arriving from a booking robot reads as the wrong
    sender. */
async function send(msg: {
  to: string
  subject: string
  html: string
  text: string
  replyTo?: string
}): Promise<EmailResult> {
  try {
    const { from, replyTo } = await mailFrom("contact")
    return await sendEmail({
      from,
      replyTo: msg.replyTo ?? replyTo,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    })
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.name : "send_failed" }
  }
}
