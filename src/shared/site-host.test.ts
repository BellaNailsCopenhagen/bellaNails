import assert from "node:assert/strict"
import { test } from "node:test"

import { isIndexableOrigin } from "@/shared/site-host"

test("only the real domain is indexable", () => {
  for (const url of [
    "https://bellanails.dk",
    "https://www.bellanails.dk",
    "https://bellanails.dk/",
  ]) {
    assert.equal(isIndexableOrigin(url), true, url)
  }
})

test("staging, previews and localhost are not", () => {
  for (const url of [
    // The value production actually held when the SEO surface shipped.
    "https://test.bellanails.dk",
    "https://bella-nails.vercel.app",
    "http://localhost:3000",
    "",
    "not a url",
  ]) {
    assert.equal(isIndexableOrigin(url), false, url)
  }
})

test("a lookalike host does not pass", () => {
  // Why the check parses the hostname instead of calling endsWith on the URL.
  assert.equal(isIndexableOrigin("https://bellanails.dk.evil.example"), false)
  assert.equal(isIndexableOrigin("https://notbellanails.dk"), false)
  assert.equal(isIndexableOrigin("https://evil.example/?x=bellanails.dk"), false)
})
