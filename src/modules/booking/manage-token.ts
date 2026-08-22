import "server-only"

import crypto from "node:crypto"

/**
 * Stateless signed manage token — lets a guest (no account) reschedule or cancel
 * from an email link. HMAC-SHA256 over the booking id: no table, no migration.
 * Usefulness is already gated by the booking's status + the 24 h policy, so the
 * token carries no expiry. A dedicated BOOKING_TOKEN_SECRET can harden it later;
 * absent, it falls back to the service-role key so links work out of the box.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL

function secret(): string {
  const key =
    process.env.BOOKING_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error("no BOOKING_TOKEN_SECRET / SUPABASE_SERVICE_ROLE_KEY")
  return key
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url")

const hmac = (bookingId: string) =>
  crypto.createHmac("sha256", secret()).update(bookingId).digest()

/** Sign a booking id into a URL-safe token: base64url(id).base64url(hmac). */
export function signBookingToken(bookingId: string): string {
  return `${b64url(bookingId)}.${b64url(hmac(bookingId))}`
}

/** Verify a token and return the booking id, or null if it doesn't check out
    (bad shape, wrong signature, or the secret is unset). */
export function verifyBookingToken(token: string): string | null {
  try {
    const [idPart, sigPart] = token.split(".")
    if (!idPart || !sigPart) return null
    const bookingId = Buffer.from(idPart, "base64url").toString("utf8")
    const sig = Buffer.from(sigPart, "base64url")
    const expected = hmac(bookingId)
    // Guard length first — timingSafeEqual throws on a length mismatch.
    if (sig.length !== expected.length) return null
    return crypto.timingSafeEqual(sig, expected) ? bookingId : null
  } catch {
    return null
  }
}

/** The guest self-service link for a booking, or undefined when it can't be
    built (missing site URL or secret) — callers treat it as optional. */
export function manageUrlFor(locale: string, bookingId: string): string | undefined {
  if (!SITE_URL) return undefined
  try {
    return `${SITE_URL}/${locale}/manage/${signBookingToken(bookingId)}`
  } catch {
    return undefined
  }
}
