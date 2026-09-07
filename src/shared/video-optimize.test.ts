import assert from "node:assert/strict"
import { test } from "node:test"

import { targetSize } from "@/shared/video-optimize"
import { VIDEO } from "@/shared/media-policy"

/**
 * Odd dimensions are the trap here: yuv420 stores chroma at half resolution, so
 * an encoder given an odd width or height refuses the frame outright — and the
 * failure surfaces as "couldn't re-encode", nowhere near the arithmetic.
 */
test("both sides come out even, at every input", () => {
  for (const [w, h] of [
    [1920, 1080],
    [1080, 1920],
    [4032, 3024],
    [1001, 999],
    [1279, 721],
    [3, 7],
  ]) {
    const out = targetSize(w, h, VIDEO.maxDim)
    assert.equal(out.width % 2, 0, `width ${out.width} from ${w}x${h}`)
    assert.equal(out.height % 2, 0, `height ${out.height} from ${w}x${h}`)
  }
})

test("the longest side lands on the cap, whichever side it is", () => {
  const landscape = targetSize(1920, 1080, 1280)
  assert.equal(landscape.width, 1280)
  assert.equal(landscape.height, 720)

  const portrait = targetSize(1080, 1920, 1280)
  assert.equal(portrait.height, 1280)
  assert.equal(portrait.width, 720)
})

test("aspect ratio survives the rounding", () => {
  const out = targetSize(4032, 3024, 1280)
  // 4:3 in, 4:3 out — within the half-pixel the even-rounding can move it.
  assert.ok(Math.abs(out.width / out.height - 4 / 3) < 0.01)
})

test("a film already small enough is left at its own size", () => {
  assert.deepEqual(targetSize(640, 480, 1280), { width: 640, height: 480 })
})

test("nothing is ever scaled up", () => {
  const out = targetSize(320, 240, 1280)
  assert.ok(out.width <= 320 && out.height <= 240)
})

test("a degenerate size still yields something an encoder accepts", () => {
  // Never 0 — a zero-dimension canvas throws rather than encoding.
  const out = targetSize(1, 1, 1280)
  assert.ok(out.width >= 2 && out.height >= 2)
})
