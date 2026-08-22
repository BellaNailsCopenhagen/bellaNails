import "server-only"

import { BRAND } from "@/config/brand"
import { STUDIO_ADDRESS, STUDIO_EMAIL, STUDIO_NAME } from "@/config/studio"
import { sendEmail } from "@/platform/email/client"
import { formatPrice } from "@/shared/money"
import { formatStudioDate, formatStudioTime } from "@/shared/studio-time"

/**
 * Transactional booking emails (Cal used to send these). Each takes PLAIN data
 * — no db access here, callers pass what they hold — and is best-effort: every
 * error is swallowed and logged so a mail failure can never fail the booking
 * action it trails. Danish default, English when `locale === "en"`.
 */

export type BookingEmailDetail = {
  to: string
  firstName: string | null
  serviceName: string
  addonNames: string[]
  startIso: string
  priceCents?: number
  previousStartIso?: string
  locale: string
}

type Kind = "confirmed" | "cancelled" | "moved"

// ── Copy (natural da / en, not machine-translated) ──────────────────────────
const COPY = {
  da: {
    greeting: (n: string | null) => (n ? `Hej ${n},` : "Hej,"),
    labels: {
      service: "Behandling",
      addons: "Tillæg",
      date: "Dato",
      time: "Tidspunkt",
      previous: "Tidligere",
      newTime: "Ny tid",
      price: "Pris",
    },
    at: (date: string, time: string) => `${date} kl. ${time}`,
    subject: {
      confirmed: `Din booking hos ${STUDIO_NAME} er bekræftet`,
      cancelled: `Din booking hos ${STUDIO_NAME} er aflyst`,
      moved: `Din booking hos ${STUDIO_NAME} er flyttet`,
    },
    intro: {
      confirmed: "Tak for din booking — din tid er hermed bekræftet.",
      cancelled:
        "Din tid er blevet aflyst. Du er altid velkommen til at booke en ny.",
      moved: "Din tid er blevet flyttet. Her er de nye detaljer.",
    },
    payment: "Betaling foregår i salonen.",
    policy: "Ombooking eller aflysning kan ske indtil 24 timer før din tid.",
    reply: "Har du spørgsmål, så svar blot på denne e-mail.",
  },
  en: {
    greeting: (n: string | null) => (n ? `Hi ${n},` : "Hi,"),
    labels: {
      service: "Service",
      addons: "Add-ons",
      date: "Date",
      time: "Time",
      previous: "Previous",
      newTime: "New time",
      price: "Price",
    },
    at: (date: string, time: string) => `${date} at ${time}`,
    subject: {
      confirmed: `Your booking at ${STUDIO_NAME} is confirmed`,
      cancelled: `Your booking at ${STUDIO_NAME} has been cancelled`,
      moved: `Your booking at ${STUDIO_NAME} has been moved`,
    },
    intro: {
      confirmed: "Thank you for your booking — your appointment is confirmed.",
      cancelled:
        "Your appointment has been cancelled. You're always welcome to book a new time.",
      moved: "Your appointment has been moved. Here are the new details.",
    },
    payment: "Payment is collected at the studio.",
    policy: "You can reschedule or cancel up to 24 hours before your appointment.",
    reply: "Questions? Just reply to this email.",
  },
} as const

const pick = (locale: string) => (locale === "en" ? COPY.en : COPY.da)

// Escape values that come from the catalog (names) before inlining into HTML.
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

// The one place the label/value pairs are decided — HTML + text share it.
function detailRows(
  d: BookingEmailDetail,
  kind: Kind,
  t: ReturnType<typeof pick>,
): [string, string][] {
  const locale = d.locale
  const rows: [string, string][] = [[t.labels.service, d.serviceName]]
  if (d.addonNames.length) rows.push([t.labels.addons, d.addonNames.join(", ")])

  if (kind === "moved" && d.previousStartIso) {
    rows.push([
      t.labels.previous,
      t.at(
        formatStudioDate(d.previousStartIso, locale),
        formatStudioTime(d.previousStartIso, locale),
      ),
    ])
    rows.push([
      t.labels.newTime,
      t.at(
        formatStudioDate(d.startIso, locale),
        formatStudioTime(d.startIso, locale),
      ),
    ])
  } else {
    rows.push([t.labels.date, formatStudioDate(d.startIso, locale)])
    rows.push([t.labels.time, formatStudioTime(d.startIso, locale)])
  }

  if (kind === "confirmed" && d.priceCents != null) {
    rows.push([t.labels.price, formatPrice(d.priceCents)])
  }
  return rows
}

// Shared chrome — one wordmark/footer wrapper so all three stay on-brand (DRY).
const FONT = "Georgia, 'Times New Roman', serif"

function renderHtml(opts: {
  greeting: string
  intro: string
  rows: [string, string][]
  paymentNote?: string
  policy: string
  reply: string
}): string {
  const rowsHtml = opts.rows
    .map(([label, value], i) => {
      const border =
        i < opts.rows.length - 1
          ? `border-bottom:1px solid ${BRAND.divider};`
          : ""
      return `<tr><td style="padding:14px 22px;${border}">
        <div style="font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND.textSecondary};margin-bottom:4px;">${esc(label)}</div>
        <div style="font-size:15px;color:${BRAND.textPrimary};">${esc(value)}</div>
      </td></tr>`
    })
    .join("")

  const paymentHtml = opts.paymentNote
    ? `<tr><td style="padding:20px 8px 0;font-size:14px;color:${BRAND.textSecondary};">${esc(opts.paymentNote)}</td></tr>`
    : ""

  return `<div style="background:${BRAND.background};margin:0;padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;border-collapse:collapse;font-family:${FONT};color:${BRAND.textPrimary};">
        <tr><td style="padding:8px 8px 28px;text-align:center;">
          <span style="font-size:22px;letter-spacing:0.14em;color:${BRAND.cta};">${esc(STUDIO_NAME)}</span>
        </td></tr>
        <tr><td style="padding:0 8px;">
          <p style="margin:0 0 12px;font-size:17px;">${esc(opts.greeting)}</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${BRAND.textSecondary};">${esc(opts.intro)}</p>
        </td></tr>
        <tr><td style="padding:0 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;background:${BRAND.card};border-radius:12px;">
            ${rowsHtml}
          </table>
        </td></tr>
        ${paymentHtml}
        <tr><td style="padding:28px 8px 0;">
          <div style="border-top:1px solid ${BRAND.divider};padding-top:20px;font-size:13px;line-height:1.7;color:${BRAND.textSecondary};">
            <div style="margin-bottom:8px;">${esc(opts.policy)}</div>
            <div style="margin-bottom:8px;">${esc(STUDIO_ADDRESS)}</div>
            <div>${esc(opts.reply)}</div>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</div>`
}

function renderText(opts: {
  greeting: string
  intro: string
  rows: [string, string][]
  paymentNote?: string
  policy: string
  reply: string
}): string {
  const lines = [
    STUDIO_NAME,
    "",
    opts.greeting,
    "",
    opts.intro,
    "",
    ...opts.rows.map(([label, value]) => `${label}: ${value}`),
  ]
  if (opts.paymentNote) lines.push("", opts.paymentNote)
  lines.push("", opts.policy, STUDIO_ADDRESS, opts.reply)
  return lines.join("\n")
}

async function send(d: BookingEmailDetail, kind: Kind): Promise<void> {
  try {
    const t = pick(d.locale)
    const rows = detailRows(d, kind, t)
    const parts = {
      greeting: t.greeting(d.firstName),
      intro: t.intro[kind],
      rows,
      paymentNote: kind === "confirmed" ? t.payment : undefined,
      policy: t.policy,
      reply: t.reply,
    }
    await sendEmail({
      from: STUDIO_EMAIL,
      replyTo: STUDIO_EMAIL,
      to: d.to,
      subject: t.subject[kind],
      html: renderHtml(parts),
      text: renderText(parts),
    })
  } catch (error) {
    // A failed email must never surface to the booking action.
    console.error(
      `[booking-email] ${kind} failed —`,
      error instanceof Error ? error.message : error,
    )
  }
}

export const sendBookingConfirmationEmail = (d: BookingEmailDetail) =>
  send(d, "confirmed")
export const sendBookingCancellationEmail = (d: BookingEmailDetail) =>
  send(d, "cancelled")
export const sendBookingRescheduleEmail = (d: BookingEmailDetail) =>
  send(d, "moved")
