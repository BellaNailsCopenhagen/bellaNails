/**
 * The "I'm not a robot" proof, as a protocol.
 *
 * This is the ALTCHA scheme (altcha.org), implemented here rather than pulled
 * in as a widget: it is a signed random salt plus a small proof-of-work, which
 * is ~30 server lines and ~20 client lines over standard primitives. Doing it
 * ourselves means no third-party script on the booking form — so no processor,
 * no cookie, no DPA and nothing to add to the privacy notice, which is the
 * whole reason this shape was chosen over reCAPTCHA or Turnstile.
 *
 * What it actually buys: the browser must spend real work before a booking is
 * accepted, so scripted volume gets expensive. It does not identify a bot, and
 * a determined attacker with compute passes it. It is one layer of several
 * (sign-in, honeypot, per-client rate limit, the 2-active cap).
 *
 * Client-safe: WebCrypto only, no `node:crypto`, no server imports.
 */

/** The only algorithm we issue or accept. */
export const HUMAN_CHECK_ALGORITHM = "SHA-256"

/**
 * Upper bound on the secret number, and so on the work. ~50k SHA-256 hashes is
 * well under a second on a phone and a real cost at scale.
 */
export const HUMAN_CHECK_MAX_NUMBER = 50_000

/** How long a challenge stays solvable. Short enough to bound replay, long
    enough that someone can fill a form in between. */
export const HUMAN_CHECK_TTL_MS = 10 * 60 * 1000

/** What the server hands the browser. */
export type HumanChallenge = {
  algorithm: typeof HUMAN_CHECK_ALGORITHM
  /** Hex SHA-256 of `salt + secretNumber` — what the browser has to reproduce. */
  challenge: string
  /** Random, and carrying the expiry; signed, so neither can be edited. */
  salt: string
  /** HMAC of `challenge`, keyed by a server secret. */
  signature: string
  maxNumber: number
}

/** What the browser sends back. Travels as base64 in one form field. */
export type HumanProof = {
  algorithm: string
  challenge: string
  salt: string
  signature: string
  number: number
}

const hex = (buffer: ArrayBuffer): string =>
  [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")

/** Hex SHA-256 — the one hash both sides compute. */
export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)

  return hex(await crypto.subtle.digest("SHA-256", data))
}

/**
 * Find the number the server hid. Brute force is the point.
 *
 * `onProgress` yields to the event loop so the tick animates and the tab never
 * looks frozen; without it the loop blocks paint on a slow phone.
 */
export async function solveHumanChallenge(
  challenge: HumanChallenge,
  onProgress?: (fraction: number) => Promise<void> | void,
): Promise<number | null> {
  const ceiling = Math.min(challenge.maxNumber, HUMAN_CHECK_MAX_NUMBER)
  for (let n = 0; n <= ceiling; n += 1) {
    if ((await sha256Hex(challenge.salt + n)) === challenge.challenge) {
      return n
    }
    // Every 1000 tries: report progress and let the browser breathe.
    if (onProgress && n % 1000 === 0) {
      await onProgress(n / ceiling)
    }
  }

  return null
}

export function encodeHumanProof(proof: HumanProof): string {
  return btoa(JSON.stringify(proof))
}

/** Decode a proof from a form field. Returns null for anything malformed —
    the caller treats that exactly like a failed check. */
export function decodeHumanProof(encoded: string): HumanProof | null {
  try {
    const parsed: unknown = JSON.parse(atob(encoded))
    if (!parsed || typeof parsed !== "object") {
      return null
    }
    const p = parsed as Record<string, unknown>
    if (
      typeof p.algorithm !== "string" ||
      typeof p.challenge !== "string" ||
      typeof p.salt !== "string" ||
      typeof p.signature !== "string" ||
      typeof p.number !== "number" ||
      !Number.isInteger(p.number)
    ) {
      return null
    }

    return {
      algorithm: p.algorithm,
      challenge: p.challenge,
      salt: p.salt,
      signature: p.signature,
      number: p.number,
    }
  } catch {
    return null
  }
}

/** The expiry rides in the salt as `…?expires=<ms>`, so it is covered by the
    signature and needs no server-side storage to enforce. */
export function expiryFromSalt(salt: string): number | null {
  const raw = new URLSearchParams(salt.split("?")[1] ?? "").get("expires")
  const ms = raw ? Number(raw) : NaN

  return Number.isFinite(ms) ? ms : null
}
