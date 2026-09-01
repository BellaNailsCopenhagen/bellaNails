import assert from "node:assert/strict"
import { test } from "node:test"

import { bookedDurationMins } from "@/shared/booking-policy"

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
