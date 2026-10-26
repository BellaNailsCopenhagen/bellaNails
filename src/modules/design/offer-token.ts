import "server-only"

import { signedToken, tokenUrl } from "@/platform/crypto/signed-token"
import { offerPath } from "@/config/routes"

/** The offer link. Namespaced so it can't be replayed as another link type. */
const token = signedToken("offer")

export const signOfferToken = token.sign
export const verifyOfferToken = token.verify

export function offerUrlFor(
  locale: string,
  offerId: string,
): string | undefined {
  try {
    return tokenUrl(`/${locale}${offerPath(token.sign(offerId))}`)
  } catch {
    return undefined
  }
}
