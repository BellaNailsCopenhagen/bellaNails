import assert from "node:assert/strict"
import { test } from "node:test"

import {
  hasOpeningHours,
  upcomingExceptions,
  weeklyOpeningDays,
} from "./opening-hours"
import type { Schedule } from "./schedule"

const standard = (weekday: number, start: string, end: string) => ({
  kind: "standard" as const,
  weekday,
  onDate: null,
  start,
  end,
})

test("the whole week comes back, closed days included", () => {
  const days = weeklyOpeningDays([standard(0, "09:00", "18:00")])
  assert.equal(days.length, 7)
  assert.deepEqual(days[0], { weekday: 0, ranges: [["09:00", "18:00"]] })
  // Every other day is present and empty, not missing.
  for (const day of days.slice(1)) assert.deepEqual(day.ranges, [])
})

test("an uneven week is reported day by day", () => {
  const days = weeklyOpeningDays([
    standard(0, "09:00", "18:00"),
    standard(3, "12:00", "20:00"),
    standard(5, "10:00", "14:00"),
  ])
  assert.deepEqual(
    days.map((d) => d.ranges.length),
    [1, 0, 0, 1, 0, 1, 0],
  )
  assert.deepEqual(days[3].ranges, [["12:00", "20:00"]])
})

test("a recurring no-work block is cut out of the day", () => {
  const days = weeklyOpeningDays([
    standard(0, "09:00", "18:00"),
    { kind: "no_work", weekday: 0, onDate: null, start: "12:00", end: "13:00" },
  ])
  assert.deepEqual(days[0].ranges, [
    ["09:00", "12:00"],
    ["13:00", "18:00"],
  ])
})

test("a day closed by a full-day no-work reads as closed", () => {
  const days = weeklyOpeningDays([
    standard(0, "09:00", "18:00"),
    { kind: "no_work", weekday: 0, onDate: null, start: "00:00", end: "23:59" },
  ])
  assert.deepEqual(days[0].ranges, [])
})

test("dated one-offs are not part of 'our hours'", () => {
  const schedule: Schedule = [
    { kind: "standard", weekday: null, onDate: "2026-09-09", start: "09:00", end: "18:00" },
  ]
  assert.equal(hasOpeningHours(schedule), false)
})

test("outside-hours rules are requestable, not open hours", () => {
  const schedule: Schedule = [
    { kind: "outside", weekday: 0, onDate: null, start: "19:00", end: "21:00" },
  ]
  assert.equal(hasOpeningHours(schedule), false)
})

test("nothing recurring at all means there is nothing to show", () => {
  assert.equal(hasOpeningHours([]), false)
  assert.equal(hasOpeningHours([standard(2, "09:00", "17:00")]), true)
})

// ── upcomingExceptions ──────────────────────────────────────────────────────
// 2026-09-07 is a Monday; day-number arithmetic is UTC days since the epoch.
const MON_2026_09_07 = Math.floor(Date.parse("2026-09-07T00:00:00Z") / 86_400_000)
const dayOf = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000)

/** Open every weekday 09-17, so a dated rule has a pattern to differ from. */
const weekdays: Schedule = [0, 1, 2, 3, 4].map((d) => standard(d, "09:00", "17:00"))

test("a dated closure is listed, and reads as closed all day", () => {
  const schedule: Schedule = [
    ...weekdays,
    {
      kind: "no_work",
      weekday: null,
      onDate: "2026-09-09",
      start: "00:00",
      end: "23:59",
      label: "Summer holiday",
    },
  ]
  assert.deepEqual(upcomingExceptions(schedule, MON_2026_09_07, 30), [
    {
      onDate: "2026-09-09",
      closedAllDay: true,
      ranges: [],
      label: "Summer holiday",
    },
  ])
})

test("a dated rule that restates the usual hours is NOT an exception", () => {
  // The whole point of diffing the EFFECT rather than listing dated rules.
  const schedule: Schedule = [
    ...weekdays,
    { kind: "standard", weekday: null, onDate: "2026-09-09", start: "09:00", end: "17:00" },
  ]
  assert.deepEqual(upcomingExceptions(schedule, MON_2026_09_07, 30), [])
})

test("an extra day on a normally-closed weekday is an exception", () => {
  // 2026-09-12 is a Saturday — closed in `weekdays`.
  const schedule: Schedule = [
    ...weekdays,
    { kind: "standard", weekday: null, onDate: "2026-09-12", start: "10:00", end: "14:00" },
  ]
  assert.deepEqual(upcomingExceptions(schedule, MON_2026_09_07, 30), [
    {
      onDate: "2026-09-12",
      closedAllDay: false,
      ranges: [["10:00", "14:00"]],
      label: null,
    },
  ])
})

test("past dates are dropped, and the horizon is half-open", () => {
  const schedule: Schedule = [
    ...weekdays,
    { kind: "no_work", weekday: null, onDate: "2026-09-04", start: "00:00", end: "23:59" },
    { kind: "no_work", weekday: null, onDate: "2026-09-09", start: "00:00", end: "23:59" },
  ]
  // Yesterday is gone; a window that stops the day before 09-09 excludes it.
  assert.deepEqual(
    upcomingExceptions(schedule, MON_2026_09_07, dayOf("2026-09-09") - MON_2026_09_07),
    [],
  )
  assert.equal(upcomingExceptions(schedule, MON_2026_09_07, 30).length, 1)
})

test("with several dated rules on a day, the one carrying a label wins", () => {
  const schedule: Schedule = [
    ...weekdays,
    { kind: "no_work", weekday: null, onDate: "2026-09-09", start: "09:00", end: "12:00" },
    {
      kind: "no_work",
      weekday: null,
      onDate: "2026-09-09",
      start: "12:00",
      end: "23:59",
      label: "Course",
    },
  ]
  assert.deepEqual(upcomingExceptions(schedule, MON_2026_09_07, 30), [
    { onDate: "2026-09-09", closedAllDay: true, ranges: [], label: "Course" },
  ])
})
