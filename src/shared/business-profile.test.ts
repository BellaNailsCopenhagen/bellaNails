import assert from "node:assert/strict"
import { test } from "node:test"

import { normalizeSocialUrl } from "./business-profile"

test("a bare handle becomes a link on the right network", () => {
  assert.equal(
    normalizeSocialUrl("instagramUrl", "bellanails"),
    "https://instagram.com/bellanails",
  )
  assert.equal(
    normalizeSocialUrl("instagramUrl", " @bellanails "),
    "https://instagram.com/bellanails",
  )
})

test("TikTok keeps the @ — its profile paths need it", () => {
  assert.equal(
    normalizeSocialUrl("tiktokUrl", "@bellanails"),
    "https://tiktok.com/@bellanails",
  )
  assert.equal(
    normalizeSocialUrl("tiktokUrl", "bellanails"),
    "https://tiktok.com/@bellanails",
  )
})

test("a handle containing a dot is still a handle", () => {
  // The bug this guards: read as a host, "bella.nails" saved as a dead link.
  assert.equal(
    normalizeSocialUrl("instagramUrl", "bella.nails"),
    "https://instagram.com/bella.nails",
  )
})

test("a pasted host-and-path is kept as typed", () => {
  assert.equal(
    normalizeSocialUrl("instagramUrl", "www.instagram.com/bellanails"),
    "https://www.instagram.com/bellanails",
  )
  assert.equal(
    normalizeSocialUrl("facebookUrl", "https://facebook.com/bellanails"),
    "https://facebook.com/bellanails",
  )
})

test("nothing, or nothing usable, is null", () => {
  assert.equal(normalizeSocialUrl("instagramUrl", ""), null)
  assert.equal(normalizeSocialUrl("instagramUrl", null), null)
  // A host with no path is a handle that lost its way.
  assert.equal(normalizeSocialUrl("instagramUrl", "https://instagram.com"), null)
})

test("a non-http scheme is refused, not rendered", () => {
  assert.equal(normalizeSocialUrl("instagramUrl", "javascript:alert(1)"), null)
  assert.equal(normalizeSocialUrl("instagramUrl", "data:text/html,x"), null)
})
