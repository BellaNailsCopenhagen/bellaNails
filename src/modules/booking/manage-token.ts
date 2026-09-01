import "server-only"

import { signedToken, tokenUrl } from "@/platform/crypto/signed-token"

/**
 * The guest self-service link — reschedule/cancel from an email without an
 * account. Usefulness is already gated by the booking's status and the 24 h
 * policy, so the token carries no expiry.
 *
 * `manage` and `approve` share one token on purpose: both mean "this booking,
 * this client".
 */
const token = signedToken("booking")

export const signBookingToken = token.sign
export const verifyBookingToken = token.verify

const linkFor = (locale: string, path: string, bookingId: string) => {
  try {
    return tokenUrl(`/${locale}/${path}/${token.sign(bookingId)}`)
  } catch {
    // No secret configured — callers treat the link as optional.
    return undefined
  }
}

export const manageUrlFor = (locale: string, bookingId: string) =>
  linkFor(locale, "manage", bookingId)

/** The guest media-release approval link — same token, /approve route. */
export const approveUrlFor = (locale: string, bookingId: string) =>
  linkFor(locale, "approve", bookingId)
