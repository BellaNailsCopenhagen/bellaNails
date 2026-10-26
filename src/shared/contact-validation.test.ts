import assert from "node:assert/strict"
import { test } from "node:test"

import { isCompleteContact, toE164 } from "@/shared/contact-validation"

const named = { name: "Anna Jensen" }

test("a name is enough to reach the confirm step", () => {
  // Phone is optional: nothing in the studio sends an SMS or places a call, so
  // a number it cannot use must not block a booking.
  assert.equal(isCompleteContact(named), true)
  assert.equal(isCompleteContact({ ...named, phone: "" }), true)
  assert.equal(isCompleteContact({ ...named, phone: "   " }), true)
})

test("a phone that IS given still has to look like one", () => {
  assert.equal(isCompleteContact({ ...named, phone: "+45 12 34 56 78" }), true)
  assert.equal(isCompleteContact({ ...named, phone: "12345678" }), true)
  assert.equal(isCompleteContact({ ...named, phone: "abc" }), false)
  assert.equal(isCompleteContact({ ...named, phone: "123" }), false)
  // "+45 " alone — what the form used to pre-seed into an optional field.
  assert.equal(isCompleteContact({ ...named, phone: "+45 " }), false)
})

test("a name is still required, and two characters is the floor", () => {
  assert.equal(isCompleteContact({}), false)
  assert.equal(isCompleteContact({ name: "A" }), false)
  assert.equal(isCompleteContact({ name: " " }), false)
  assert.equal(isCompleteContact({ name: "Bo" }), true)
})

test("email is required only when the sign-in gate is off", () => {
  assert.equal(isCompleteContact(named, { requireEmail: true }), false)
  assert.equal(
    isCompleteContact(
      { ...named, email: "anna@example.dk" },
      { requireEmail: true },
    ),
    true,
  )
  assert.equal(
    isCompleteContact(
      { ...named, email: "not-an-email" },
      { requireEmail: true },
    ),
    false,
  )
  // With the gate ON the session supplies it, so its absence is fine.
  assert.equal(isCompleteContact(named), true)
})

test("toE164 leaves a blank phone as null rather than inventing one", () => {
  assert.equal(toE164(""), null)
  assert.equal(toE164(undefined), null)
  assert.equal(toE164("+45 "), null)
  assert.equal(toE164("12345678"), "+4512345678")
})
