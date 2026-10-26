import assert from "node:assert/strict"
import { test } from "node:test"

import {
  shouldScrollTestimonials,
  shouldShowTestimonials,
  TESTIMONIAL_MAX_BODY,
  TESTIMONIAL_MIN_BODY,
  validateTestimonial,
} from "@/shared/testimonial"

const ok = {
  authorName: "Mia Sørensen",
  body: "x".repeat(TESTIMONIAL_MIN_BODY),
  consent: true,
}

test("the section hides below two, shows from two", () => {
  assert.equal(shouldShowTestimonials(0), false)
  assert.equal(shouldShowTestimonials(1), false)
  assert.equal(shouldShowTestimonials(2), true)
  assert.equal(shouldShowTestimonials(9), true)
})

test("it scrolls only ABOVE three", () => {
  assert.equal(shouldScrollTestimonials(3), false)
  assert.equal(shouldScrollTestimonials(4), true)
})

test("a name and a body of real length are required", () => {
  assert.deepEqual(validateTestimonial({ ...ok, authorName: "   " }), {
    ok: false,
    field: "authorName",
    reason: "missing",
  })
  assert.deepEqual(validateTestimonial({ ...ok, body: "  " }), {
    ok: false,
    field: "body",
    reason: "missing",
  })
  assert.deepEqual(validateTestimonial({ ...ok, body: "too short" }), {
    ok: false,
    field: "body",
    reason: "tooShort",
  })
  assert.deepEqual(
    validateTestimonial({ ...ok, body: "x".repeat(TESTIMONIAL_MAX_BODY + 1) }),
    { ok: false, field: "body", reason: "tooLong" },
  )
})

test("consent is required — publication is the whole purpose", () => {
  assert.deepEqual(validateTestimonial({ ...ok, consent: false }), {
    ok: false,
    field: "consent",
    reason: "missing",
  })
})

test("consent is checked BEFORE the other fields, so the reason is the real one", () => {
  // A blank form with no consent reports consent, not a missing name.
  const r = validateTestimonial({ authorName: "", body: "", consent: false })
  assert.equal(r.ok, false)
  assert.equal(!r.ok && r.field, "consent")
})

test("occupation is optional and trimmed away when blank", () => {
  const bare = validateTestimonial(ok)
  assert.equal(bare.ok, true)
  assert.equal(bare.ok && bare.value.occupation, null)

  const blank = validateTestimonial({ ...ok, occupation: "   " })
  assert.equal(blank.ok && blank.value.occupation, null)

  const given = validateTestimonial({ ...ok, occupation: "  Architect  " })
  assert.equal(given.ok && given.value.occupation, "Architect")
})

test("values come back trimmed, so what was checked is what gets stored", () => {
  const r = validateTestimonial({
    authorName: "  Mia  ",
    body: `  ${"y".repeat(30)}  `,
    consent: true,
  })
  assert.equal(r.ok, true)
  assert.equal(r.ok && r.value.authorName, "Mia")
  assert.equal(r.ok && r.value.body, "y".repeat(30))
})
