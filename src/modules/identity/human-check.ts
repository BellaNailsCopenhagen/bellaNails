import "server-only"

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

import type { Db } from "@/db/client"
import { takeDurableToken } from "@/db/rate-limits"
import {
  decodeHumanProof,
  expiryFromSalt,
  sha256Hex,
  HUMAN_CHECK_ALGORITHM,
  HUMAN_CHECK_MAX_NUMBER,
  HUMAN_CHECK_TTL_MS,
  type HumanChallenge,
} from "@/shared/human-check"

/**
 * Issuing and checking the "I'm not a robot" proof. See `shared/human-check.ts`
 * for what the scheme is and what it is worth.
 *
 * Env-guarded like every other integration: with no secret set there is nothing
 * to sign with, so `issueHumanChallenge` returns null and the caller treats the
 * check as unavailable rather than failing every booking. The flag in App
 * settings is how the artist turns it off deliberately; a missing key is how it
 * degrades.
 */

function secret(): string | null {
  return process.env.HUMAN_CHECK_SECRET || null
}

export function humanCheckConfigured(): boolean {
  return secret() !== null
}

const sign = (key: string, value: string): string =>
  createHmac("sha256", key).update(value).digest("hex")

/** A fresh challenge, or null when unconfigured. */
export async function issueHumanChallenge(): Promise<HumanChallenge | null> {
  const key = secret()
  if (!key) return null

  // The salt carries its own expiry, so the signature covers it and nothing has
  // to be stored between issuing and verifying.
  const salt = `${randomBytes(12).toString("hex")}?expires=${Date.now() + HUMAN_CHECK_TTL_MS}`
  const number = randomBytes(4).readUInt32BE(0) % HUMAN_CHECK_MAX_NUMBER
  const challenge = await sha256Hex(salt + number)

  return {
    algorithm: HUMAN_CHECK_ALGORITHM,
    challenge,
    salt,
    signature: sign(key, challenge),
    maxNumber: HUMAN_CHECK_MAX_NUMBER,
  }
}

export type HumanCheckOutcome =
  | { ok: true }
  /** `unavailable` = no secret configured. The caller decides whether that is
      fatal; every other reason is a real failure. */
  | { ok: false; reason: "unavailable" | "missing" | "invalid" | "expired" | "reused" }

/**
 * Is this proof genuine? Three things have to hold, cheapest first, so a junk
 * payload costs nothing:
 *
 *   1. the signature is ours (so the challenge wasn't invented client-side),
 *   2. the salt hasn't expired,
 *   3. `sha256(salt + number)` really is the challenge — the work was done.
 *
 * Deliberately does NOT consume the proof. Verification runs early to reject
 * rubbish before any real work; spending it is `spendHumanProof`, which runs
 * with the other write guards — otherwise a taken slot or the booking cap would
 * burn a valid proof and the client's next attempt would fail the check they
 * had just passed.
 */
export async function verifyHumanProof(
  encoded: string | undefined,
): Promise<HumanCheckOutcome> {
  const key = secret()
  if (!key) return { ok: false, reason: "unavailable" }
  if (!encoded?.trim()) return { ok: false, reason: "missing" }

  const proof = decodeHumanProof(encoded)
  if (!proof || proof.algorithm !== HUMAN_CHECK_ALGORITHM) {
    return { ok: false, reason: "invalid" }
  }

  const expected = sign(key, proof.challenge)
  if (!equalHex(expected, proof.signature)) return { ok: false, reason: "invalid" }

  const expires = expiryFromSalt(proof.salt)
  if (expires === null || expires < Date.now()) return { ok: false, reason: "expired" }

  if (proof.number < 0 || proof.number > HUMAN_CHECK_MAX_NUMBER) {
    return { ok: false, reason: "invalid" }
  }
  if ((await sha256Hex(proof.salt + proof.number)) !== proof.challenge) {
    return { ok: false, reason: "invalid" }
  }

  return { ok: true }
}

/**
 * Claim this proof's one use. Call it immediately before the write, once
 * everything else has passed.
 *
 * Rides the durable limiter with a limit of one, because "may be used once in
 * this window" is exactly what a fixed-window counter of 1 means — a separate
 * store for spent proofs would be the same table under another name.
 *
 * Fails OPEN on a database error, like the limiter it uses: the proof was
 * already verified, and blocking a booking on a transient error is worse.
 */
export async function spendHumanProof(
  db: Db,
  encoded: string | undefined,
): Promise<HumanCheckOutcome> {
  const proof = encoded ? decodeHumanProof(encoded) : null
  // Unverifiable here means it never passed verification either.
  if (!proof) return { ok: false, reason: "invalid" }

  const fresh = await takeDurableToken(db, `human:${proof.salt}`, {
    limit: 1,
    window: "20 minutes",
  })
  return fresh ? { ok: true } : { ok: false, reason: "reused" }
}

const HEX_DIGEST = /^[0-9a-f]+$/i

/**
 * Constant-time compare of two hex digests.
 *
 * The shape check is not cosmetic: `Buffer.from("zz…", "hex")` decodes to
 * nothing, so two equal-LENGTH strings can yield different-length buffers and
 * `timingSafeEqual` throws — turning a junk signature into a 500 instead of a
 * rejection.
 */
function equalHex(a: string, b: string): boolean {
  if (a.length !== b.length || !HEX_DIGEST.test(b)) return false
  const left = Buffer.from(a, "hex")
  const right = Buffer.from(b, "hex")
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}
