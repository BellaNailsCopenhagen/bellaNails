import "server-only"

import { signedToken, tokenUrl } from "@/platform/crypto/signed-token"
import { testimonialPath } from "@/config/routes"

/** The invitation link. Namespaced so it can't be replayed as another link type. */
const token = signedToken("testimonial")

export const signTestimonialToken = token.sign
export const verifyTestimonialToken = token.verify

export function testimonialUrlFor(locale: string, id: string): string | undefined {
  try {
    return tokenUrl(`/${locale}${testimonialPath(token.sign(id))}`)
  } catch {
    // No secret configured — the email degrades to no button.
    return undefined
  }
}
