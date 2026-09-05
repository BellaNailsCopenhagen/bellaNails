import assert from "node:assert/strict"
import { test } from "node:test"

import {
  RELEASE_PURPOSES,
  fillReleasePurposes,
  isRegrant,
  type ReleasePurposeState,
} from "@/shared/media-release"

/**
 * The card's shape must not depend on what happens to be stored. My Space reads
 * the release rows in whatever order Postgres returns them, so before this the
 * list reshuffled under the client's finger every time they answered something —
 * and a purpose nobody had asked about was simply absent.
 */

const purposes = (states: ReleasePurposeState[]) =>
  fillReleasePurposes(states).map((s) => s.purpose)

test("every purpose is present, in the constant's order", () => {
  assert.deepEqual(purposes([]), [...RELEASE_PURPOSES])
})

test("the input's order does not reach the output", () => {
  const reversed: ReleasePurposeState[] = [
    { purpose: "education", status: "granted" },
    { purpose: "social", status: "declined" },
    { purpose: "website", status: "requested" },
  ]
  assert.deepEqual(purposes(reversed), [...RELEASE_PURPOSES])
})

test("a stored status survives, a missing one reads as never asked", () => {
  const filled = fillReleasePurposes([
    { purpose: "social", status: "withdrawn" },
  ])
  assert.deepEqual(filled, [
    { purpose: "website", status: "none" },
    { purpose: "social", status: "withdrawn" },
    { purpose: "education", status: "none" },
  ])
})

test("only a withdrawal makes the next grant an 'again'", () => {
  assert.equal(isRegrant("withdrawn"), true)
  // A first ask and a refusal both read plainly as "allow".
  assert.equal(isRegrant("none"), false)
  assert.equal(isRegrant("declined"), false)
})
