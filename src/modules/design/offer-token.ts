import "server-only"

import crypto from "node:crypto"

/**
 * Stateless signed offer token — the client opens their offer from an email
 * link with no account lookup. HMAC-SHA256 over the offer id: no table, no
 * migration, the same shape as the guest manage-link token.
 *
 * The token carries no expiry of its own because the OFFER carries one: every
 * read re-checks `offerState`, so a stale link resolves to an expired/used
 * offer and a friendly dead end rather than a booking. A dedicated
 * BOOKING_TOKEN_SECRET can rotate link validity; absent, it falls back to the
 * service-role key so links work out of the box.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL

function secret(): string {
  const key =
    process.env.BOOKING_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error("no BOOKING_TOKEN_SECRET / SUPABASE_SERVICE_ROLE_KEY")
  return key
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url")

// Namespaced so an offer token can never be replayed as a booking-manage token.
const hmac = (offerId: string) =>
  crypto.createHmac("sha256", secret()).update(`offer:${offerId}`).digest()

/** Sign an offer id into a URL-safe token: base64url(id).base64url(hmac). */
export function signOfferToken(offerId: string): string {
  return `${b64url(offerId)}.${b64url(hmac(offerId))}`
}

/** Verify a token and return the offer id, or null if it doesn't check out
    (bad shape, wrong signature, or the secret is unset). */
export function verifyOfferToken(token: string): string | null {
  try {
    const [idPart, sigPart] = token.split(".")
    if (!idPart || !sigPart) return null
    const offerId = Buffer.from(idPart, "base64url").toString("utf8")
    const sig = Buffer.from(sigPart, "base64url")
    const expected = hmac(offerId)
    // Guard length first — timingSafeEqual throws on a length mismatch.
    if (sig.length !== expected.length) return null
    return crypto.timingSafeEqual(sig, expected) ? offerId : null
  } catch {
    return null
  }
}

/** The client's link to an offer, or undefined when it can't be built (missing
    site URL or secret) — callers treat it as optional. */
export function offerUrlFor(locale: string, offerId: string): string | undefined {
  if (!SITE_URL) return undefined
  try {
    return `${SITE_URL}/${locale}/offer/${signOfferToken(offerId)}`
  } catch {
    return undefined
  }
}
