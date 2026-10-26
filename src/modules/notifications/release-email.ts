import "server-only"

import { BRAND } from "@/config/brand"
import { STUDIO_NAME } from "@/config/studio"
import { mailFrom } from "@/modules/notifications/sender"
import { sendEmail, type EmailResult } from "@/platform/email/client"
import { esc, FONT } from "@/modules/notifications/email-layout"
import { pickReleaseCopy, type ReleasePurpose } from "@/shared/media-release"

/**
 * The media-release request email — asks the client to approve using their
 * appointment's photos/videos, linking to the public /approve page. Copy is the
 * same da/en source the page uses (shared/media-release), so the ask reads
 * identically by email and on the page. Best-effort like the other sends.
 */
export type ReleaseEmailDetail = {
  to: string
  firstName: string | null
  locale: string
  serviceName: string
  when: string
  ref: string
  purposes: ReleasePurpose[]
  approveUrl: string
}

export async function sendMediaReleaseRequestEmail(
  d: ReleaseEmailDetail,
): Promise<EmailResult> {
  try {
    const copy = pickReleaseCopy(d.locale)
    const isEn = d.locale === "en"
    const greeting = d.firstName
      ? isEn
        ? `Hi ${d.firstName},`
        : `Hej ${d.firstName},`
      : isEn
        ? "Hi,"
        : "Hej,"
    const cta = isEn ? "Review & respond" : "Se og svar"
    const items = d.purposes
      .map(
        (p) =>
          `<li>${esc(copy.purposes[p].label)} — ${esc(copy.purposes[p].description)}</li>`,
      )
      .join("")
    const itemsText = d.purposes
      .map(
        (p) => `- ${copy.purposes[p].label}: ${copy.purposes[p].description}`,
      )
      .join("\n")

    const html = `<div style="background:${BRAND.background};margin:0;padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;font-family:${FONT};color:${BRAND.textPrimary};">
      <tr><td style="padding:8px 8px 24px;text-align:center;">
        <span style="font-size:22px;letter-spacing:0.14em;color:${BRAND.cta};">${esc(STUDIO_NAME)}</span>
      </td></tr>
      <tr><td style="padding:0 8px;">
        <p style="margin:0 0 12px;font-size:17px;">${esc(greeting)}</p>
        <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:${BRAND.textSecondary};">
          ${esc(copy.appointment(d.serviceName, d.when, d.ref))} — ${esc(copy.intro)}
        </p>
        <ul style="font-size:15px;line-height:1.6;color:${BRAND.textSecondary};padding-left:20px;">${items}</ul>
        <p style="margin:16px 0;">
          <a href="${esc(d.approveUrl)}" style="display:inline-block;background:${BRAND.cta};color:${BRAND.background};text-decoration:none;padding:12px 22px;border-radius:8px;font-size:15px;">${esc(cta)}</a>
        </p>
        <p style="margin:0 0 8px;font-size:13px;line-height:1.7;color:${BRAND.textSecondary};">${esc(copy.withdrawal)}</p>
      </td></tr>
    </table>
  </td></tr></table>
</div>`

    const text = [
      STUDIO_NAME,
      "",
      greeting,
      "",
      `${copy.appointment(d.serviceName, d.when, d.ref)} — ${copy.intro}`,
      itemsText,
      "",
      `${cta}: ${d.approveUrl}`,
      "",
      copy.withdrawal,
    ].join("\n")

    const subject = isEn
      ? `${STUDIO_NAME}: permission to use your photos & video`
      : `${STUDIO_NAME}: tilladelse til at bruge dine billeder og video`

    return await sendEmail({
      ...(await mailFrom("booking")),
      to: d.to,
      subject,
      html,
      text,
    })
  } catch (error) {
    console.error(
      "[release-email] failed —",
      error instanceof Error ? error.message : error,
    )

    return {
      ok: false,
      error: error instanceof Error ? error.name : "send_error",
    }
  }
}
