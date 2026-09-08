import assert from "node:assert/strict"
import { test } from "node:test"

import { sanitizeSelectedAddonIds } from "@/shared/booking-totals"

// Three things enforce add-on compatibility: the customizer's checkbox locking,
// this (which re-reads a hand-edited ?addons=), and buildBookingDraft, which
// refuses at persist time. This one is the pure rule, so it is the testable one.
const addons = [{ id: "massage" }, { id: "art" }, { id: "colour" }, { id: "stones" }]
const pairs: [string, string][] = [
  ["massage", "art"],
  ["colour", "massage"],
]

test("a compatible selection is kept, in URL order", () => {
  assert.deepEqual(
    sanitizeSelectedAddonIds(["stones", "art"], addons, pairs),
    ["stones", "art"],
  )
})

test("a clashing id is dropped, and the earlier one wins", () => {
  assert.deepEqual(sanitizeSelectedAddonIds(["massage", "art"], addons, pairs), ["massage"])
  // Reversing the URL reverses which survives — order is the tie-break.
  assert.deepEqual(sanitizeSelectedAddonIds(["art", "massage"], addons, pairs), ["art"])
})

test("a pair written the other way round still clashes", () => {
  // `["colour", "massage"]` is stored in that order; asking for massage first
  // must still drop colour.
  assert.deepEqual(sanitizeSelectedAddonIds(["massage", "colour"], addons, pairs), ["massage"])
})

test("an id that isn't one of this service's add-ons is dropped", () => {
  assert.deepEqual(sanitizeSelectedAddonIds(["nope", "stones"], addons, pairs), ["stones"])
})

test("duplicates are dropped rather than charged twice", () => {
  assert.deepEqual(sanitizeSelectedAddonIds(["stones", "stones"], addons, pairs), ["stones"])
})

test("one clash does not take the rest of the selection with it", () => {
  assert.deepEqual(
    sanitizeSelectedAddonIds(["massage", "art", "stones"], addons, pairs),
    ["massage", "stones"],
  )
})
