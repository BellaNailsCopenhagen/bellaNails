import assert from "node:assert/strict"
import { test } from "node:test"

import { safeInternalPath } from "./safe-next"

test("keeps an internal path, query and all", () => {
  assert.equal(safeInternalPath("/da/book?service=abc&step=confirm"), "/da/book?service=abc&step=confirm")
})

test("rejects the escapes a startsWith('//') guard misses", () => {
  // WHATWG reads a backslash as a slash, so this is the one that got through.
  assert.equal(safeInternalPath("/\\evil.com"), "/")
  assert.equal(safeInternalPath("//evil.com"), "/")
  assert.equal(safeInternalPath("https://evil.com"), "/")
  assert.equal(safeInternalPath("javascript:alert(1)"), "/")
})

test("falls back to home for nothing useful", () => {
  assert.equal(safeInternalPath(null), "/")
  assert.equal(safeInternalPath(""), "/")
  assert.equal(safeInternalPath("book"), "/")
})
