import assert from "node:assert/strict"
import { test } from "node:test"

import { takeToken, type RateLimitState } from "@/shared/rate-limit"

const RULE = { limit: 3, windowMs: 1000 }
const T0 = 1_000_000

test("allows up to the limit, then refuses", () => {
  const state: RateLimitState = new Map()
  assert.equal(takeToken(state, "a", T0, RULE), true)
  assert.equal(takeToken(state, "a", T0, RULE), true)
  assert.equal(takeToken(state, "a", T0, RULE), true)
  assert.equal(takeToken(state, "a", T0, RULE), false)
})

test("keys are independent", () => {
  const state: RateLimitState = new Map()
  for (let i = 0; i < 3; i++) {
    takeToken(state, "a", T0, RULE)
  }
  assert.equal(takeToken(state, "a", T0, RULE), false)
  assert.equal(takeToken(state, "b", T0, RULE), true)
})

test("the window rolls over", () => {
  const state: RateLimitState = new Map()
  for (let i = 0; i < 3; i++) {
    takeToken(state, "a", T0, RULE)
  }
  assert.equal(takeToken(state, "a", T0 + 999, RULE), false)
  assert.equal(takeToken(state, "a", T0 + 1000, RULE), true)
})

test("dead keys are swept, so the map doesn't grow forever", () => {
  const state: RateLimitState = new Map()
  takeToken(state, "old", T0, RULE)
  assert.equal(state.size, 1)
  // A later window for a different key sweeps the expired one.
  takeToken(state, "new", T0 + 5000, RULE)
  assert.equal(state.size, 1)
  assert.equal(state.has("old"), false)
})
