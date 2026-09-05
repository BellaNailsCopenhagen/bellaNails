import "server-only"

import { BRAND } from "@/config/brand"
import { STUDIO_NAME } from "@/config/studio"
import { mailFrom } from "@/modules/notifications/sender"
import { getBusinessProfile } from "@/modules/business/profile"
import { mapsUrlFor, oneLineAddress } from "@/shared/business-profile"
import { sendEmail, type EmailResult } from "@/platform/email/client"
import { esc, FONT } from "@/modules/notifications/email-layout"
import { formatPrice } from "@/shared/money"
import { formatStudioDate, formatStudioTime } from "@/shared/studio-time"

import { buildBookingIcs } from "./booking-ics"
import { pick, type Kind } from "./booking-email-copy"

/**
 * Transactional booking emails (Cal used to send these). Each takes PLAIN data
 * — no db access here, callers pass what they hold — and is best-effort: every
 * error is swallowed and logged so a mail failure can never fail the booking
 * action it trails. Copy lives in ./booking-email-copy; the invite in
 * ./booking-ics. Danish default, English when `locale === "en"`.
 */

export type BookingEmailDetail = {
  to: string
  firstName: string | null
  serviceName: string
  addonNames: string[]
  startIso: string
  endIso: string
  priceCents?: number
  previousStartIso?: string
  // Guest self-service link (confirm + reschedule carry it; cancel doesn't).
  manageUrl?: string
  // Stable UID for the .ics event, so a reschedule updates the same entry.
  bookingId: string
  // Who acted — drives the cancel/reschedule intro wording.
  actor: "client" | "studio"
  locale: string
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

  if ((kind === "confirmed" || kind === "reminder") && d.priceCents != null) {
    rows.push([t.labels.price, formatPrice(d.priceCents)])
  }
  return rows
}


type RenderParts = {
  greeting: string
  intro: string
  rows: [string, string][]
  paymentNote?: string
  policy: string
  manageUrl?: string
  manageCta?: string
  reply: string
  /** Passed in, not imported: the business sets its own address, so a renderer
      that reached for a constant would print last year's one. */
  address: string
  mapsUrl: string
}

function renderHtml(opts: RenderParts): string {
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

  const manageHtml =
    opts.manageUrl && opts.manageCta
      ? `<div style="margin-bottom:8px;"><a href="${esc(opts.manageUrl)}" style="color:${BRAND.cta};text-decoration:underline;">${esc(opts.manageCta)}</a></div>`
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
            ${manageHtml}
            ${opts.address ? `<div style="margin-bottom:8px;"><a href="${esc(opts.mapsUrl)}" style="color:${BRAND.textSecondary};text-decoration:underline;">${esc(opts.address)}</a></div>` : ""}
            <div>${esc(opts.reply)}</div>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</div>`
}

function renderText(opts: RenderParts): string {
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
  lines.push("", opts.policy)
  if (opts.manageUrl && opts.manageCta) {
    lines.push(`${opts.manageCta}: ${opts.manageUrl}`)
  }
  if (opts.address) lines.push(`${opts.address} — ${opts.mapsUrl}`)
  lines.push(opts.reply)
  return lines.join("\n")
}

async function send(d: BookingEmailDetail, kind: Kind): Promise<EmailResult> {
  try {
    const t = pick(d.locale)
    const introRaw = t.intro[kind]
    const profile = await getBusinessProfile()
    const parts: RenderParts = {
      address: oneLineAddress(profile),
      mapsUrl: mapsUrlFor(profile) ?? "",
      greeting: t.greeting(d.firstName),
      intro: typeof introRaw === "string" ? introRaw : introRaw[d.actor],
      rows: detailRows(d, kind, t),
      paymentNote:
        kind === "confirmed" || kind === "reminder" ? t.payment : undefined,
      policy: t.policy,
      manageUrl: d.manageUrl,
      manageCta: d.manageUrl ? t.manageCta : undefined,
      reply: t.reply,
    }
    // Add-to-calendar on confirm/reschedule; a CANCEL invite drops the entry.
    const ics = buildBookingIcs({
      bookingId: d.bookingId,
      startIso: d.startIso,
      endIso: d.endIso,
      serviceName: d.serviceName,
      cancelled: kind === "cancelled",
      location: oneLineAddress(profile),
    })
    return await sendEmail({
      ...(await mailFrom("booking")),
      to: d.to,
      subject: t.subject[kind],
      html: renderHtml(parts),
      text: renderText(parts),
      calendar: ics
        ? {
            content: ics,
            method: kind === "cancelled" ? "CANCEL" : "PUBLISH",
            filename: "appointment.ics",
          }
        : undefined,
    })
  } catch (error) {
    // A failed email must never surface to the booking action.
    console.error(
      `[booking-email] ${kind} failed —`,
      error instanceof Error ? error.message : error,
    )
    // Non-PII name only (an .ics/render throw here, not the SMTP message).
    return { ok: false, error: error instanceof Error ? error.name : "send_error" }
  }
}

export const sendBookingConfirmationEmail = (d: BookingEmailDetail) =>
  send(d, "confirmed")
export const sendBookingCancellationEmail = (d: BookingEmailDetail) =>
  send(d, "cancelled")
export const sendBookingRescheduleEmail = (d: BookingEmailDetail) =>
  send(d, "moved")
export const sendBookingReminderEmail = (d: BookingEmailDetail) =>
  send(d, "reminder")
