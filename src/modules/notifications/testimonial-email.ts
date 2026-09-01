import "server-only"

import { BOOKING_FROM_EMAIL, STUDIO_EMAIL, STUDIO_NAME } from "@/config/studio"
import {
  buttonHtml,
  greetOf,
  para,
  shell,
} from "@/modules/notifications/email-layout"
import { sendEmail, type EmailResult } from "@/platform/email/client"

/**
 * The invitation to write a testimonial. One email, deliberately: it asks, it
 * links, and it makes clear the words stay theirs and only appear if they're
 * happy for them to. No follow-up chasing — a second ask is the artist's call,
 * and the open-request index stops it becoming a queue of nags.
 */

export async function sendTestimonialRequestEmail(d: {
  to: string
  firstName: string | null
  locale: string
  url?: string
}): Promise<EmailResult> {
  const isEn = d.locale === "en"
  const heading = isEn
    ? "Would you say a few words?"
    : "Vil du sige et par ord?"
  const intro = isEn
    ? "If you enjoyed your time at the studio, a sentence or two from you would mean a great deal — and it helps someone else decide to come."
    : "Hvis du var glad for din tid i salonen, vil et par sætninger fra dig betyde meget — og det hjælper andre med at turde tage skridtet."
  const what = isEn
    ? "Your name, what you do if you'd like to say, and a short thought. It takes a minute."
    : "Dit navn, hvad du laver hvis du har lyst til at nævne det, og en kort tanke. Det tager et minut."
  const control = isEn
    ? "Nothing is published automatically — we read it first, and you can ask us to remove it at any time."
    : "Intet offentliggøres automatisk — vi læser det først, og du kan altid bede os fjerne det."
  const cta = isEn ? "Write a few words" : "Skriv et par ord"

  try {
    return await sendEmail({
      from: BOOKING_FROM_EMAIL,
      replyTo: STUDIO_EMAIL,
      to: d.to,
      subject: isEn
        ? `${STUDIO_NAME} — would you say a few words?`
        : `${STUDIO_NAME} — vil du sige et par ord?`,
      html: shell({
        eyebrow: isEn ? "A small favour" : "En lille tjeneste",
        heading,
        greeting: greetOf(d.firstName, isEn),
        bodyHtml: [
          para(intro),
          para(what),
          d.url ? buttonHtml(d.url, cta) : "",
          para(control),
        ].join(""),
      }),
      text: [
        STUDIO_NAME,
        heading,
        "",
        greetOf(d.firstName, isEn),
        intro,
        "",
        what,
        ...(d.url ? ["", `${cta}: ${d.url}`] : []),
        "",
        control,
      ].join("\n"),
    })
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.name : "send_failed" }
  }
}
