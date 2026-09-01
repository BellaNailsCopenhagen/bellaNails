import assert from "node:assert/strict"
import { test } from "node:test"

import { buttonHtml, esc, greetOf } from "@/modules/notifications/email-layout"

test("esc escapes every character that could break out of markup", () => {
  assert.equal(esc("a & b"), "a &amp; b")
  assert.equal(esc("<script>"), "&lt;script&gt;")
  // Quotes matter because templates interpolate into attributes, not just text.
  assert.equal(esc('say "hi"'), "say &quot;hi&quot;")
  assert.equal(esc("it's"), "it&#39;s")
})

test("esc escapes the ampersand first, so entities aren't double-broken", () => {
  assert.equal(esc("&lt;"), "&amp;lt;")
})

test("a crafted value cannot escape an href attribute", () => {
  const html = buttonHtml('https://x.dk/" onmouseover="alert(1)', "Book")
  assert.ok(!html.includes('" onmouseover="'), html)
  assert.ok(html.includes("&quot;"))
})

test("greetOf falls back to a bare greeting per locale", () => {
  assert.equal(greetOf("Mia", true), "Hi Mia,")
  assert.equal(greetOf("Mia", false), "Hej Mia,")
  assert.equal(greetOf(null, true), "Hi,")
  assert.equal(greetOf(null, false), "Hej,")
})
