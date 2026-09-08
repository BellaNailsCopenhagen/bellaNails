import assert from "node:assert/strict"
import { test } from "node:test"

import {
  bookedDurationMins,
  canRequestMediaConsent,
  canRequestReview,
  MEDIA_REQUEST_LEAD_MS,
} from "@/shared/booking-policy"

const booking = (
  selected_addons: unknown,
  start = "2026-09-01T10:00:00.000Z",
  end = "2026-09-01T11:30:00.000Z",
) => ({ start_time: start, end_time: end, selected_addons })

test("bookedDurationMins prefers the as-booked snapshot", () => {
  // The snapshot says 90 even though the row spans 60 — the snapshot wins, so a
  // since-edited catalog can never resize an existing appointment.
  const row = booking(
    { totalDurationMins: 90 },
    "2026-09-01T10:00:00.000Z",
    "2026-09-01T11:00:00.000Z",
  )
  assert.equal(bookedDurationMins(row), 90)
})

test("bookedDurationMins falls back to the row's own span", () => {
  assert.equal(bookedDurationMins(booking({})), 90)
  assert.equal(bookedDurationMins(booking(null)), 90)
})

test("bookedDurationMins ignores a non-positive or non-numeric snapshot", () => {
  assert.equal(bookedDurationMins(booking({ totalDurationMins: 0 })), 90)
  assert.equal(bookedDurationMins(booking({ totalDurationMins: -30 })), 90)
  assert.equal(bookedDurationMins(booking({ totalDurationMins: "90" })), 90)
})

test("bookedDurationMins returns 0 when nothing is derivable", () => {
  // A zero-length or inverted row yields 0, and every caller guards on > 0
  // rather than generating slots for a zero-minute appointment.
  assert.equal(bookedDurationMins(booking({}, "2026-09-01T10:00:00.000Z", "2026-09-01T10:00:00.000Z")), 0)
  assert.equal(bookedDurationMins(booking({}, "2026-09-01T11:00:00.000Z", "2026-09-01T10:00:00.000Z")), 0)
})

// The two request rules are enforced server-side as well as on the card, so
// their boundaries are worth pinning: an action refuses on the strength of them.
const START = Date.parse("2026-09-01T10:00:00.000Z")
const END = Date.parse("2026-09-01T11:30:00.000Z")
const appt = (status = "confirmed") => ({
  status,
  start_time: new Date(START).toISOString(),
  end_time: new Date(END).toISOString(),
})

test("media consent opens 30 min before the start, not before", () => {
  assert.equal(canRequestMediaConsent(appt(), START - MEDIA_REQUEST_LEAD_MS - 1), false)
  assert.equal(canRequestMediaConsent(appt(), START - MEDIA_REQUEST_LEAD_MS), true)
  assert.equal(canRequestMediaConsent(appt(), END + 86_400_000), true)
})

test("review opens 30 min before the END, not the start", () => {
  // The gap between the two rules is the point: mid-appointment you can ask for
  // photos but not yet for a review.
  assert.equal(canRequestReview(appt(), START), false)
  assert.equal(canRequestReview(appt(), END - MEDIA_REQUEST_LEAD_MS - 1), false)
  assert.equal(canRequestReview(appt(), END - MEDIA_REQUEST_LEAD_MS), true)
})

test("neither is offered for a cancelled or no-show booking", () => {
  const late = END + 86_400_000
  assert.equal(canRequestMediaConsent(appt("cancelled"), late), false)
  assert.equal(canRequestReview(appt("cancelled"), late), false)
})
