import assert from "node:assert/strict"
import { test } from "node:test"

import {
  bookedDurationMins,
  canRequestMediaConsent,
  canRequestReview,
  MEDIA_REQUEST_LEAD_MS,
  REQUEST_HORIZON_DAYS,
  requestTimeProblem,
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

// The only bound on a booking request's time — the slot check is off — and it
// has to hold on the way in AND when the artist accepts.
const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse("2026-09-08T09:00:00.000Z")
const iso = (ms: number) => new Date(ms).toISOString()

test("a sensible future time is accepted", () => {
  assert.equal(requestTimeProblem(iso(NOW + DAY), NOW), null)
})

test("the past is refused — this is accepting a stale Adjust-time sheet", () => {
  assert.equal(requestTimeProblem(iso(NOW - 1), NOW), "past")
  assert.equal(requestTimeProblem(iso(NOW - 30 * DAY), NOW), "past")
  // Exactly now is not in the past.
  assert.equal(requestTimeProblem(iso(NOW), NOW), null)
})

test("beyond the horizon is refused, and the boundary is inclusive", () => {
  assert.equal(requestTimeProblem(iso(NOW + REQUEST_HORIZON_DAYS * DAY), NOW), null)
  assert.equal(
    requestTimeProblem(iso(NOW + REQUEST_HORIZON_DAYS * DAY + 1), NOW),
    "tooFar",
  )
})

test("an unparseable time is its own answer, not silently past", () => {
  assert.equal(requestTimeProblem("not a date", NOW), "invalid")
  assert.equal(requestTimeProblem("", NOW), "invalid")
})
