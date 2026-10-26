import assert from "node:assert/strict"
import { test } from "node:test"

import { safeInternalPath } from "./safe-next"

test("keeps an internal path, query and all", () => {
  assert.equal(
    safeInternalPath("/da/book?service=abc&step=confirm", "/da"),
    "/da/book?service=abc&step=confirm",
  )
})

test("rejects the escapes a startsWith('//') guard misses", () => {
  // WHATWG reads a backslash as a slash, so this is the one that got through.
  assert.equal(safeInternalPath("/\\evil.com", "/da"), "/da")
  assert.equal(safeInternalPath("//evil.com", "/da"), "/da")
  assert.equal(safeInternalPath("https://evil.com", "/da"), "/da")
  assert.equal(safeInternalPath("javascript:alert(1)", "/da"), "/da")
})

test("falls back to the caller's home for nothing useful", () => {
  assert.equal(safeInternalPath(null, "/da"), "/da")
  assert.equal(safeInternalPath("", "/da"), "/da")
  assert.equal(safeInternalPath("book", "/da"), "/da")
})

test("the fallback is the caller's, not a hardcoded '/'", () => {
  // The whole point of QA-01: "/" re-negotiates the locale, so an English
  // sign-in must not be handed back a Danish home, or vice versa.
  assert.equal(safeInternalPath(null, "/en"), "/en")
  assert.equal(safeInternalPath("//evil.com", "/en"), "/en")
})
