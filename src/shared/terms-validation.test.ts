import assert from "node:assert/strict"
import { test } from "node:test"

import {
  canPublishTerms,
  termsProblem,
  TERMS_MIN_BODY,
} from "@/shared/terms-validation"

const body = "x".repeat(TERMS_MIN_BODY)
const good = { titleEn: "Terms", titleDk: "Betingelser", bodyEn: body, bodyDk: body }

test("a document with both languages filled in can be published", () => {
  assert.equal(termsProblem(good), null)
  assert.equal(canPublishTerms(good), true)
})

test("an empty editor is refused, and says which field", () => {
  const problem = termsProblem({ titleEn: "", titleDk: "", bodyEn: "", bodyDk: "" })
  assert.equal(problem?.field, "titleEn")
  assert.match(problem!.message, /English title/)
})

test("whitespace is not content — this is the accidental Publish", () => {
  // `trim() || null` used to turn these into an all-NULL current version, which
  // is immediately what /terms and /privacy serve.
  assert.equal(canPublishTerms({ ...good, bodyDk: "   \n\t  " }), false)
  assert.equal(canPublishTerms({ ...good, titleDk: "  " }), false)
})

test("one language filled in is not enough", () => {
  assert.equal(termsProblem({ ...good, bodyDk: "" })?.field, "bodyDk")
  assert.equal(termsProblem({ ...good, titleEn: "" })?.field, "titleEn")
})

test("a stray keystroke is too short to be a document", () => {
  const problem = termsProblem({ ...good, bodyEn: "x" })
  assert.equal(problem?.field, "bodyEn")
  assert.match(problem!.message, /too short/)
})
