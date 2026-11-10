import assert from "node:assert/strict"
import { test } from "node:test"

import { studioDayNumber } from "./studio-time"
import {
  groupIntoAgenda,
  groupBookingsByWeek,
  groupBookingsByMonth,
} from "./booking-agenda"
import type { DisplayBooking } from "./booking-view"

const booking = (id: string, startIso: string): DisplayBooking =>
  ({ row: { id, start_time: startIso, end_time: startIso } } as unknown as DisplayBooking)

const monday = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`).getTime()

test("groupIntoAgenda groups bookings by week → day, soonest first", () => {
  const now = monday("2026-07-06") // Monday
  const b1 = booking("b1", "2026-07-06T09:00:00Z") // Monday
  const b2 = booking("b2", "2026-07-07T14:00:00Z") // Tuesday
  const b3 = booking("b3", "2026-07-06T11:00:00Z") // Monday, later

  const weeks = groupIntoAgenda([b1, b2, b3], now)
  assert.equal(weeks.length, 1)
  assert.equal(weeks[0].isCurrent, true)
  assert.equal(weeks[0].count, 3)

  const mondayBookings = weeks[0].days.find((d) => d.dayNumber === studioDayNumber(now))!
  assert.equal(mondayBookings.bookings.length, 2)
  // Soonest first on the same day
  assert.equal(mondayBookings.bookings[0].row.id, "b1")
  assert.equal(mondayBookings.bookings[1].row.id, "b3")

  const tuesdayBookings = weeks[0].days.find((d) => d.dayNumber === studioDayNumber(now + 86_400_000))!
  assert.equal(tuesdayBookings.bookings[0].row.id, "b2")
})

test("groupIntoAgenda includes empty weeks within the horizon", () => {
  const now = monday("2026-07-06")
  const b1 = booking("b1", "2026-07-06T09:00:00Z") // this week
  const b2 = booking("b2", "2026-07-20T09:00:00Z") // +2 weeks

  const weeks = groupIntoAgenda([b1, b2], now)
  assert.ok(weeks.length >= 2, `expected at least 2 weeks, got ${weeks.length}`)

  const current = weeks.find((w) => w.isCurrent)!
  assert.equal(current.count, 1)

  const future = weeks.find((w) => w.offset === 2)!
  assert.equal(future.count, 1)
})

test("groupBookingsByWeek asc orders soonest first", () => {
  const now = monday("2026-07-06")
  const b1 = booking("b1", "2026-07-06T09:00:00Z")
  const b2 = booking("b2", "2026-07-13T09:00:00Z") // next week

  const weeks = groupBookingsByWeek([b2, b1], now, "asc")
  assert.equal(weeks[0].offset, 0)
  assert.equal(weeks[0].bookings[0].row.id, "b1")
  assert.equal(weeks[1].offset, 1)
  assert.equal(weeks[1].bookings[0].row.id, "b2")
})

test("groupBookingsByWeek desc orders most-recent first", () => {
  const now = monday("2026-07-06")
  const b1 = booking("b1", "2026-07-06T09:00:00Z")
  const b2 = booking("b2", "2026-07-13T09:00:00Z")

  const weeks = groupBookingsByWeek([b1, b2], now, "desc")
  assert.equal(weeks[0].offset, 1)
  assert.equal(weeks[0].bookings[0].row.id, "b2")
  assert.equal(weeks[1].offset, 0)
  assert.equal(weeks[1].bookings[0].row.id, "b1")
})

test("groupBookingsByMonth groups by studio month", () => {
  const b1 = booking("b1", "2026-07-10T09:00:00Z") // July
  const b2 = booking("b2", "2026-08-05T09:00:00Z") // August

  const months = groupBookingsByMonth([b2, b1], "asc")
  assert.equal(months.length, 2)
  assert.equal(months[0].monthKey, 2026 * 12 + 6) // July = month 7 → key 2026*12+6
  assert.equal(months[0].bookings[0].row.id, "b1")
  assert.equal(months[1].monthKey, 2026 * 12 + 7) // August
  assert.equal(months[1].bookings[0].row.id, "b2")
})
