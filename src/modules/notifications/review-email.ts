import "server-only"

import { STUDIO_NAME } from "@/config/studio"
import { buttonHtml, greetOf, para, shell } from "@/modules/notifications/email-layout"
import { mailFrom } from "@/modules/notifications/sender"
import { sendEmail, type EmailResult } from "@/platform/email/client"

/**
 * The "how was your visit?" email — the studio asking, by hand, once an
 * appointment is essentially done. The link is her external review profile
 * (Google); the action that calls this refuses when there isn't one.
 *
 * Lives here rather than inside the action for the same reason every other send
 * does: the copy is two languages of client-facing prose, and an action is
 * where authorization and side effects belong, not wording.
 */
export async function sendReviewRequestEmail(d: {
  to: string
  firstName: string | null
  locale: string
  reviewUrl: string
}): Promise<EmailResult> {
  try {
    const isEn = d.locale === "en"
    const cta = isEn ? "Leave a review" : "Skriv en anmeldelse"
    const line = isEn
      ? `Thank you for visiting ${STUDIO_NAME}. If you enjoyed it, a quick review would mean a lot — it is how new clients find us.`
      : `Tak fordi du besøgte ${STUDIO_NAME}. Hvis du var glad for det, vil en hurtig anmeldelse betyde meget — det er sådan nye kunder finder os.`

    return await sendEmail({
      ...(await mailFrom("booking")),
      to: d.to,
      subject: isEn
        ? `How was your visit to ${STUDIO_NAME}?`
        : `Hvordan var dit besøg hos ${STUDIO_NAME}?`,
      html: shell({
        eyebrow: isEn ? "Thank you" : "Tak",
        heading: isEn ? "How was your visit?" : "Hvordan var dit besøg?",
        greeting: greetOf(d.firstName, isEn),
        bodyHtml: para(line, false) + buttonHtml(d.reviewUrl, cta),
      }),
      text: `${greetOf(d.firstName, isEn)}\n\n${line}\n\n${cta}: ${d.reviewUrl}`,
    })
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "review email failed",
    }
  }
}
