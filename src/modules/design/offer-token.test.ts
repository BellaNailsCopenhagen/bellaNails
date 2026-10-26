import assert from "node:assert/strict"
import { test } from "node:test"

process.env.BOOKING_TOKEN_SECRET ??= "test-secret-for-offer-tokens"

const { signOfferToken, verifyOfferToken } =
  await import("@/modules/design/offer-token")
const { signBookingToken } = await import("@/modules/booking/manage-token")

const ID = "0f9c3a10-1c2b-4d5e-8a7b-000000000001"

test("a signed offer token round-trips", () => {
  assert.equal(verifyOfferToken(signOfferToken(ID)), ID)
})

test("a tampered id is rejected", () => {
  const [, sig] = signOfferToken(ID).split(".")
  const forged = `${Buffer.from("some-other-id").toString("base64url")}.${sig}`
  assert.equal(verifyOfferToken(forged), null)
})

test("a tampered signature is rejected", () => {
  const [id] = signOfferToken(ID).split(".")
  assert.equal(
    verifyOfferToken(`${id}.${Buffer.from("nope").toString("base64url")}`),
    null,
  )
})

test("malformed tokens are rejected rather than thrown", () => {
  for (const bad of ["", ".", "abc", "a.b.c", "!!!.???"]) {
    assert.equal(verifyOfferToken(bad), null)
  }
})

test("a booking-manage token cannot be replayed as an offer token", () => {
  // Both sign the same id with the same secret; the namespace prefix is what
  // keeps one from authorising the other.
  assert.equal(verifyOfferToken(signBookingToken(ID)), null)
})
