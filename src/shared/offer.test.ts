import assert from "node:assert/strict"
import { test } from "node:test"

import { isOfferLive, offerExpiryFrom, offerState } from "@/shared/offer"

const NOW = Date.parse("2026-09-01T12:00:00.000Z")
const future = "2026-09-15T12:00:00.000Z"
const past = "2026-08-20T12:00:00.000Z"

test("a fresh offer with time left is live", () => {
  assert.equal(offerState({ expires_at: future }, NOW), "live")
  assert.equal(isOfferLive({ expires_at: future }, NOW), true)
})

test("expiry is exclusive at the boundary", () => {
  // Exactly at the deadline counts as expired — no half-second grace.
  assert.equal(offerState({ expires_at: new Date(NOW).toISOString() }, NOW), "expired")
  assert.equal(offerState({ expires_at: new Date(NOW + 1).toISOString() }, NOW), "live")
})

test("withdrawn wins over every other state", () => {
  assert.equal(
    offerState({ expires_at: past, withdrawn_at: past, booking_id: "b1" }, NOW),
    "withdrawn",
  )
})

test("a used offer reads as used even once expired", () => {
  assert.equal(offerState({ expires_at: past, booking_id: "b1" }, NOW), "used")
})

test("a closed offer reads as expired, and withdrawal keeps its own message", () => {
  // The expiry sweep sets closed_at only; a withdrawal sets both. That is what
  // lets one immutable column drive the one-live-offer index while the client
  // still sees the right reason.
  assert.equal(offerState({ expires_at: future, closed_at: past }, NOW), "expired")
  assert.equal(
    offerState({ expires_at: future, closed_at: past, withdrawn_at: past }, NOW),
    "withdrawn",
  )
})

test("a booked offer stays 'used' once closed", () => {
  assert.equal(
    offerState({ expires_at: past, closed_at: past, booking_id: "b1" }, NOW),
    "used",
  )
})

test("offerExpiryFrom adds whole days", () => {
  assert.equal(offerExpiryFrom(NOW, 14), "2026-09-15T12:00:00.000Z")
  assert.equal(offerExpiryFrom(NOW, 1), "2026-09-02T12:00:00.000Z")
})
