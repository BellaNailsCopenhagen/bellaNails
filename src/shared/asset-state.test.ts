import assert from "node:assert/strict"
import { test } from "node:test"

import {
  canRequestRelease,
  deriveAssetState,
  type PublishedCopy,
} from "@/shared/asset-state"

/**
 * The hub's state rule, walked the way a photo actually travels. Every image is
 * the artist's own now, so each state has to answer "whose move is it?" — and
 * the two axes it reads (the client's consent, the artist's placement) belong to
 * different people and must not be collapsed into each other.
 */

const nothingAsked = { website: "none", social: "none", education: "none" }
const copy = (o: Partial<PublishedCopy> = {}): PublishedCopy => ({
  purpose: "website",
  needsTakedown: false,
  placements: 0,
  ...o,
})

test("a photo's life, from upload to live", () => {
  // She uploads it against the appointment and has asked nobody.
  let releases = { ...nothingAsked }
  assert.equal(deriveAssetState(releases, []), "to_ask")

  // She asks for both places.
  releases = { ...releases, website: "requested", social: "requested" }
  assert.equal(deriveAssetState(releases, []), "waiting")

  // The client allows the website, and only that.
  releases = { ...releases, website: "granted", social: "declined" }
  assert.equal(deriveAssetState(releases, []), "ready")

  // She puts it in the gallery — one step, which is what publishes the copy.
  const placed = [copy({ placements: 1 })]
  assert.equal(deriveAssetState(releases, placed), "live")

  // She takes it off the gallery again; the copy goes with the last placement.
  assert.equal(deriveAssetState(releases, []), "ready")
})

test("a withdrawal on a live social photo outranks everything", () => {
  const releases = { ...nothingAsked, social: "withdrawn" }
  const live = [copy({ purpose: "social", needsTakedown: true, placements: 1 })]
  assert.equal(deriveAssetState(releases, live), "takedown")
})

test("teaching consent publishes nothing, so it never queues work", () => {
  // It used to read "Ready" — a promise of somewhere to place it, when the card
  // offers website and social only and there was nothing to do.
  const only = { ...nothingAsked, education: "granted" }
  assert.equal(deriveAssetState(only, []), "to_ask")

  // And it must not drown out a refusal on a purpose that CAN be published.
  const refused = { ...only, website: "declined" }
  assert.equal(deriveAssetState(refused, []), "declined")
})

test("a refusal outranks silence, so a 'no' stops sitting in the to-do list", () => {
  const refused = { ...nothingAsked, website: "declined" }
  assert.equal(deriveAssetState(refused, []), "declined")
})

test("saying no and taking it back are different events, and stay apart", () => {
  // A retraction means it was allowed once — possibly public — and someone
  // changed their mind. Folding it into "declined" hid which had happened.
  const takenBack = { ...nothingAsked, website: "withdrawn" }
  assert.equal(deriveAssetState(takenBack, []), "retracted")

  // And when both are true of one appointment, the change of mind is the one
  // worth showing.
  const both = { ...nothingAsked, website: "withdrawn", social: "declined" }
  assert.equal(deriveAssetState(both, []), "retracted")
})

test("a grant outranks a refusal — there is still somewhere to put it", () => {
  const mixed = { ...nothingAsked, website: "granted", social: "declined" }
  assert.equal(deriveAssetState(mixed, []), "ready")
})

test("being published beats a request still pending on the other purpose", () => {
  // Releases are per BOOKING, so every photo of it shares them. A request left
  // open on one purpose must not hide a photo that is already public.
  const mixed = { ...nothingAsked, website: "granted", social: "requested" }
  assert.equal(deriveAssetState(mixed, [copy({ placements: 1 })]), "live")
})

test("permission can be asked for again after a no, but not while it stands", () => {
  assert.equal(canRequestRelease(undefined), true)
  assert.equal(canRequestRelease("none"), true)
  assert.equal(canRequestRelease("declined"), true)
  assert.equal(canRequestRelease("withdrawn"), true)
  // Asking again would only nag: one is already out, the other already said yes.
  assert.equal(canRequestRelease("requested"), false)
  assert.equal(canRequestRelease("granted"), false)
})

test("a photo with no appointment has nobody to ask, so it queues nothing", () => {
  // Permission is per appointment. An unlinked photo can never be asked about,
  // and it used to sit in "To ask" forever, inflating a badge over work that
  // could not be done — the card offers no ask button at all.
  assert.equal(deriveAssetState(nothingAsked, [], false), "unlinked")

  // Even if something was somehow published from it, the fix is the same one:
  // re-add it from the appointment it belongs to.
  assert.equal(
    deriveAssetState(nothingAsked, [copy({ placements: 1 })], false),
    "unlinked",
  )
})
