import assert from "node:assert/strict"
import { test } from "node:test"

import {
  CLIENT_IMAGE,
  HERO_VIDEO_MAX_BYTES,
  PORTFOLIO_IMAGE,
  imagePolicy,
  kindForKey,
} from "@/shared/media-policy"

/**
 * The hero stores ONE key and reads photo-or-film off its extension. Nothing
 * else records which it is, so if this function is wrong the home page renders
 * an `<img>` pointed at an MP4 — or an autoplaying `<video>` pointed at a JPG.
 */
test("a stored key says whether it is a photo or a film", () => {
  assert.equal(kindForKey("public/a1b2.mp4"), "video")
  assert.equal(kindForKey("public/a1b2.webm"), "video")
  assert.equal(kindForKey("public/a1b2.jpg"), "image")
  assert.equal(kindForKey("public/a1b2.png"), "image")
  assert.equal(kindForKey("public/a1b2.webp"), "image")
})

test("the extension is matched whatever its case", () => {
  assert.equal(kindForKey("public/a1b2.MP4"), "video")
  assert.equal(kindForKey("public/a1b2.WebM"), "video")
})

test("anything unreadable falls to image, which fails visibly", () => {
  // A missing or unknown extension must not render an autoplaying <video>
  // pointed at nothing: an <img> at least shows as a broken picture.
  assert.equal(kindForKey("public/a1b2"), "image")
  assert.equal(kindForKey("public/a1b2.pdf"), "image")
  assert.equal(kindForKey(""), "image")
})

test("a dot earlier in the path doesn't count as the extension", () => {
  assert.equal(kindForKey("public/my.holiday.clip.mp4"), "video")
  assert.equal(kindForKey("public/my.clip.folder/photo.jpg"), "image")
})

/** The tier is the server's answer to "whose upload is this". A client getting
    the portfolio tier would mean bigger files from the one uploader we don't
    control the volume of. */
test("only the owner gets the portfolio tier", () => {
  assert.deepEqual(imagePolicy(true), PORTFOLIO_IMAGE)
  assert.deepEqual(imagePolicy(false), CLIENT_IMAGE)
  assert.ok(PORTFOLIO_IMAGE.maxDim > CLIENT_IMAGE.maxDim)
})

test("the hero film cap stays in the range the admin promises", () => {
  // The admin tells her a whole number of MB; a cap that isn't one would make
  // that copy a lie.
  assert.equal(HERO_VIDEO_MAX_BYTES % (1024 * 1024), 0)
})
