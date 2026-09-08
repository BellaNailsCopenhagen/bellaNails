import assert from "node:assert/strict"
import { test } from "node:test"

import { parseKroner } from "@/shared/money"

/**
 * The one place a typo silently becomes a wrong number. `Number("1.200")` is
 * 1.2, so a naive parse turned 1200 kr into 120 øre and reported success.
 */

test("a thousands separator is not a decimal point", () => {
  assert.equal(parseKroner("1.200"), 1200) // Danish grouping
  assert.equal(parseKroner("1,200"), 1200) // English grouping
  assert.equal(parseKroner("1.200,50"), 1200.5)
  assert.equal(parseKroner("1,200.50"), 1200.5)
})

test("a plain amount reads as itself", () => {
  assert.equal(parseKroner("420"), 420)
  assert.equal(parseKroner("420,50"), 420.5)
  assert.equal(parseKroner("420.5"), 420.5)
  assert.equal(parseKroner(" 700 "), 700)
})

test("zero is a real amount — it means nothing was taken", () => {
  assert.equal(parseKroner("0"), 0)
  assert.equal(parseKroner("0,00"), 0)
})

test("anything unreadable is refused, never guessed at", () => {
  // Each of these used to fall through to the CLEAR branch, deleting an amount
  // she had set and reporting it as success.
  assert.equal(parseKroner(""), null)
  assert.equal(parseKroner("   "), null)
  assert.equal(parseKroner("12o0"), null)
  assert.equal(parseKroner("kr 400"), null)
  assert.equal(parseKroner("-50"), null)
})

// QA-09: the reason the catalog sheets must parse the STRING, not Number().
test("an empty box is missing, not free — the QA-09 trap", () => {
  assert.equal(Number(""), 0) // what the sheets used to send
  assert.equal(parseKroner(""), null) // what they send now
  // And a deliberate zero still reads as zero, which a free add-on needs.
  assert.equal(parseKroner("0"), 0)
})
