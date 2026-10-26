import "server-only"

import crypto from "node:crypto"

/**
 * Stateless signed link tokens: `base64url(id).base64url(hmac)`.
 *
 * One factory rather than a copy per link type — the verification path (the
 * length guard before `timingSafeEqual`, the secret fallback, the namespace that
 * stops one link being replayed as another) has to be fixed in one place.
 *
 * Tokens carry no expiry: the ROW's state is the gate, so a spent link resolves
 * to a dead end rather than an action.
 */
export type SignedToken = {
  sign: (id: string) => string
  /** The id, or null on a bad shape, a wrong signature, or a missing secret. */
  verify: (token: string) => string | null
}

function secret(): string {
  const key = process.env.BOOKING_TOKEN_SECRET
  if (!key) throw new Error("no BOOKING_TOKEN_SECRET — set it to a long random string (e.g., openssl rand -hex 32)")
  return key
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url")

export function signedToken(namespace: string): SignedToken {
  const hmac = (id: string) =>
    crypto.createHmac("sha256", secret()).update(`${namespace}:${id}`).digest()

  return {
    sign: (id) => `${b64url(id)}.${b64url(hmac(id))}`,
    verify: (token) => {
      try {
        const [idPart, sigPart] = token.split(".")
        if (!idPart || !sigPart) return null
        const id = Buffer.from(idPart, "base64url").toString("utf8")
        const sig = Buffer.from(sigPart, "base64url")
        const expected = hmac(id)
        // Guard length first — timingSafeEqual throws on a mismatch.
        if (sig.length !== expected.length) return null
        return crypto.timingSafeEqual(sig, expected) ? id : null
      } catch {
        return null
      }
    },
  }
}

/** An absolute link for a signed token, or undefined when the site URL is unset
    — callers treat it as optional so an email degrades to no button. */
export function tokenUrl(path: string): string | undefined {
  const site = process.env.NEXT_PUBLIC_SITE_URL
  return site ? `${site}${path}` : undefined
}
