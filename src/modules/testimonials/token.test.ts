import assert from "node:assert/strict"
import { test } from "node:test"

process.env.BOOKING_TOKEN_SECRET ??= "test-secret-for-testimonial-tokens"

const { signTestimonialToken, verifyTestimonialToken } = await import(
  "@/modules/testimonials/token"
)
const { signOfferToken } = await import("@/modules/design/offer-token")
const { signBookingToken } = await import("@/modules/booking/manage-token")

const ID = "3a7c1e90-2b4d-4f6a-9c8b-000000000002"

test("a signed testimonial token round-trips", () => {
  assert.equal(verifyTestimonialToken(signTestimonialToken(ID)), ID)
})

test("tampering with either half is rejected", () => {
  const [id, sig] = signTestimonialToken(ID).split(".")
  assert.equal(
    verifyTestimonialToken(`${Buffer.from("other").toString("base64url")}.${sig}`),
    null,
  )
  assert.equal(
    verifyTestimonialToken(`${id}.${Buffer.from("nope").toString("base64url")}`),
    null,
  )
})

test("malformed tokens return null rather than throwing", () => {
  for (const bad of ["", ".", "abc", "a.b.c", "!!!.???"]) {
    assert.equal(verifyTestimonialToken(bad), null)
  }
})

test("no other token type can be replayed as a testimonial token", () => {
  // Same id, same secret — only the namespace prefix separates them.
  assert.equal(verifyTestimonialToken(signOfferToken(ID)), null)
  assert.equal(verifyTestimonialToken(signBookingToken(ID)), null)
})
