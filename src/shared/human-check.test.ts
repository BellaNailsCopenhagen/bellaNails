import assert from "node:assert/strict"
import { test } from "node:test"

import {
  decodeHumanProof,
  encodeHumanProof,
  expiryFromSalt,
  sha256Hex,
  solveHumanChallenge,
  HUMAN_CHECK_ALGORITHM,
  type HumanChallenge,
} from "./human-check"

const challengeFor = async (
  salt: string,
  number: number,
): Promise<HumanChallenge> => ({
  algorithm: HUMAN_CHECK_ALGORITHM,
  challenge: await sha256Hex(salt + number),
  salt,
  signature: "not-checked-client-side",
  maxNumber: 500,
})

test("the solver finds the number the challenge hides", async () => {
  const challenge = await challengeFor("abc?expires=1", 137)
  assert.equal(await solveHumanChallenge(challenge), 137)
})

test("a challenge whose answer is out of range doesn't hang — it fails", async () => {
  const challenge = { ...(await challengeFor("abc?expires=1", 137)), maxNumber: 10 }
  assert.equal(await solveHumanChallenge(challenge), null)
})

test("a proof survives the round trip through a form field", () => {
  const proof = {
    algorithm: HUMAN_CHECK_ALGORITHM,
    challenge: "aa",
    salt: "bb?expires=9",
    signature: "cc",
    number: 42,
  }
  assert.deepEqual(decodeHumanProof(encodeHumanProof(proof)), proof)
})

test("junk decodes to null rather than throwing at the caller", () => {
  assert.equal(decodeHumanProof("not-base64!!"), null)
  assert.equal(decodeHumanProof(btoa("{}")), null)
  // A non-integer number would sail past a plain typeof check.
  assert.equal(
    decodeHumanProof(
      btoa(JSON.stringify({ algorithm: "SHA-256", challenge: "a", salt: "b", signature: "c", number: 1.5 })),
    ),
    null,
  )
})

test("the expiry is read out of the salt, so the signature covers it", () => {
  assert.equal(expiryFromSalt("abc?expires=1750000000000"), 1750000000000)
  assert.equal(expiryFromSalt("abc"), null)
  assert.equal(expiryFromSalt("abc?expires=soon"), null)
})
