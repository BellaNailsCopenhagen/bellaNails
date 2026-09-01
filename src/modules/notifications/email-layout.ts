import "server-only"

import { BRAND } from "@/config/brand"
import { STUDIO_NAME } from "@/config/studio"

/**
 * The chrome every transactional email shares: the serif stack, HTML escaping,
 * the greeting, and the wordmark wrapper. Extracted because `FONT`, `esc` and
 * the greeting had drifted into three near-identical copies across the email
 * modules — a fix in one wouldn't have reached the others.
 *
 * Each email still owns its own BODY markup; only the frame is shared.
 */

export const FONT = "Georgia, 'Times New Roman', serif"

/**
 * Escape an interpolated value. Every value reaching a template is
 * client-supplied until proven otherwise, and templates interpolate into
 * ATTRIBUTES as well as text (`href="${esc(url)}"`), so quotes must be escaped
 * too — without that, a value containing a quote breaks out of the attribute.
 */
export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export const greetOf = (firstName: string | null, isEn: boolean) =>
  firstName
    ? isEn
      ? `Hi ${firstName},`
      : `Hej ${firstName},`
    : isEn
      ? "Hi,"
      : "Hej,"

/** Wordmark + eyebrow + heading + greeting, then the caller's body. */
export function shell(opts: {
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

/** A body paragraph. `muted` is the default; pass false for emphasis. */
export const para = (text: string, muted = true) =>
  `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${
    muted ? BRAND.textSecondary : BRAND.textPrimary
  };">${esc(text)}</p>`

/** The client's own words, quoted back. */
export const quote = (text: string) =>
  `<blockquote style="margin:0 0 16px;padding:12px 16px;border-left:2px solid ${BRAND.divider};font-size:15px;line-height:1.6;color:${BRAND.textPrimary};">${esc(text)}</blockquote>`

/** A primary action link, styled as a button. */
export function buttonHtml(href: string, label: string): string {
  return `<p style="margin:0 0 20px;">
    <a href="${esc(href)}" style="display:inline-block;padding:12px 22px;background:${BRAND.cta};color:${BRAND.background};font-size:15px;text-decoration:none;">${esc(label)}</a>
  </p>`
}
