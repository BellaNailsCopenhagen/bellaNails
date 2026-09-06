import assert from "node:assert/strict"
import { test } from "node:test"

import {
  capacityMins,
  computeSpan,
  countsAsEarned,
  countsAsOccupied,
  effectiveIncomeCents,
  footprintMins,
  isIncomeAdjusted,
  occupancyPercent,
  type IncomeBooking,
} from "@/shared/insights"
import type { Schedule } from "@/shared/schedule"
import { weekdayIndexForDayNumber } from "@/shared/studio-hours"

const NOW = Date.parse("2026-09-06T12:00:00Z")

const booking = (over: Partial<IncomeBooking> = {}): IncomeBooking => ({
  start_time: "2026-09-01T09:00:00Z",
  end_time: "2026-09-01T10:00:00Z",
  status: "confirmed",
  total_price_cents: 45000,
  income_override_cents: null,
  no_show_at: null,
  selected_addons: {},
  ...over,
})

test("a correction of zero is a real answer, not a missing one", () => {
  // `||` here would re-earn money that was refunded — the whole reason the
  // override column exists is to be able to say "this brought in nothing".
  assert.equal(effectiveIncomeCents(booking({ income_override_cents: 0 })), 0)
  assert.equal(effectiveIncomeCents(booking()), 45000)
  assert.equal(
    effectiveIncomeCents(booking({ income_override_cents: 20000 })),
    20000,
  )
  // Nothing booked and nothing corrected earns nothing, rather than crashing.
  assert.equal(effectiveIncomeCents(booking({ total_price_cents: null })), 0)
})

test("only a hand-entered figure counts as adjusted", () => {
  assert.equal(isIncomeAdjusted(booking()), false)
  assert.equal(isIncomeAdjusted(booking({ income_override_cents: 0 })), true)
})

test("a no-show earns nothing, however the booking still reads", () => {
  // `no_show_at` is our own marker and `status` deliberately stays active, so
  // without checking it every missed appointment reports its full booked price.
  const missed = booking({ no_show_at: "2026-09-01T10:05:00Z" })
  assert.equal(countsAsEarned(missed, NOW), false)
  // But the slot was blocked and could not be sold — that time WAS used.
  assert.equal(countsAsOccupied(missed, NOW), true)

  // Unless she charged a fee for it, which is exactly what the override is for.
  const charged = booking({
    no_show_at: "2026-09-01T10:05:00Z",
    income_override_cents: 15000,
  })
  assert.equal(countsAsEarned(charged, NOW), true)
})

test("an override earns money without taking time", () => {
  // A deposit on next month's appointment: real income, no hours worked yet.
  const deposit = booking({
    start_time: "2026-10-01T09:00:00Z",
    end_time: "2026-10-01T10:00:00Z",
    income_override_cents: 10000,
  })
  assert.equal(countsAsEarned(deposit, NOW), true)
  assert.equal(countsAsOccupied(deposit, NOW), false)

  // A fee on a cancelled slot: the hour was freed and is sellable again.
  const cancelledFee = booking({ status: "cancelled", income_override_cents: 15000 })
  assert.equal(countsAsEarned(cancelledFee, NOW), true)
  assert.equal(countsAsOccupied(cancelledFee, NOW), false)
})

test("money is earned once the appointment is over and still stands", () => {
  assert.equal(countsAsEarned(booking(), NOW), true)

  const future = booking({
    start_time: "2026-10-01T09:00:00Z",
    end_time: "2026-10-01T10:00:00Z",
  })
  assert.equal(countsAsEarned(future, NOW), false)

  assert.equal(countsAsEarned(booking({ status: "cancelled" }), NOW), false)
})

test("an explicit correction always counts, whatever the appointment did", () => {
  // The no-show fee on a cancelled slot, and the refund on one that happened.
  const cancelledButCharged = booking({
    status: "cancelled",
    income_override_cents: 15000,
  })
  assert.equal(countsAsEarned(cancelledButCharged, NOW), true)

  // Even a future one: if she has already recorded a deposit, it is real.
  const futureDeposit = booking({
    start_time: "2026-10-01T09:00:00Z",
    end_time: "2026-10-01T10:00:00Z",
    income_override_cents: 10000,
  })
  assert.equal(countsAsEarned(futureDeposit, NOW), true)
})

test("an appointment costs the day its length plus the turnaround", () => {
  // 60 minutes booked + a 30-minute buffer the calendar blocks after it.
  assert.equal(footprintMins(booking(), 30), 90)
  // The as-booked snapshot wins over the raw span when it is there.
  assert.equal(
    footprintMins(booking({ selected_addons: { totalDurationMins: 45 } }), 30),
    75,
  )
})

const schedule: Schedule = [
  // Mondays 09:00-17:00 — 480 open minutes.
  { kind: "standard", weekday: 0, onDate: null, start: "09:00", end: "17:00" },
]

test("capacity counts only days that have already happened", () => {
  // Three Mondays. Derived, not written down: a day-number is days since the
  // epoch and 1970-01-01 was a Thursday, so a hand-picked one is a coin flip.
  let monday = 20700
  while (weekdayIndexForDayNumber(monday) !== 0) monday++
  const mondays = [monday, monday + 7, monday + 14]

  // Standing on the second Monday at 13:00: the first Monday in full (480), and
  // today only 09:00-13:00 (240).
  assert.equal(capacityMins(schedule, mondays, monday + 7, 13 * 60), 720)
  // Standing after all three, well past closing.
  assert.equal(capacityMins(schedule, mondays, monday + 21, 23 * 60), 1440)
})

test("today counts only as far as the clock has got", () => {
  const monday = (() => {
    let d = 20700
    while (weekdayIndexForDayNumber(d) !== 0) d++
    return d
  })()
  // Before opening, none of today is behind us.
  assert.equal(capacityMins(schedule, [monday], monday, 8 * 60), 0)
  // Mid-morning: 09:00-10:30.
  assert.equal(capacityMins(schedule, [monday], monday, 10 * 60 + 30), 90)
  // After closing, the whole day.
  assert.equal(capacityMins(schedule, [monday], monday, 20 * 60), 480)
})

test("no open hours is not nought per cent — it is not a question", () => {
  assert.equal(occupancyPercent(0, 0), null)
  // Nor is "we never recorded what your hours were that month". Showing 0% there
  // would read as a catastrophic month rather than a missing measurement.
  assert.equal(occupancyPercent(900, null), null)
  assert.equal(occupancyPercent(90, 480), 19)
  assert.equal(occupancyPercent(480, 480), 100)
})

test("the read covers only the months that need it", () => {
  // The steady state — one month of appointments instead of a year of them.
  assert.deepEqual(computeSpan([24312]), { fromKey: 24312, toKey: 24312 })
  assert.deepEqual(computeSpan([24305, 24312]), { fromKey: 24305, toKey: 24312 })
  // Nothing to do means no booking read at all.
  assert.equal(computeSpan([]), null)
})
