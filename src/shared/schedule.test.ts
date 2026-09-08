import assert from "node:assert/strict"
import { test } from "node:test"

import { isWithinStandardHours, type Schedule } from "@/shared/schedule"
import { studioWallTimeToInstant } from "@/shared/studio-time"
import { dayNumberForIso } from "@/shared/studio-hours"

// The studio's real pattern: Saturday and Sunday 10:00–18:00, weekdays closed.
const schedule: Schedule = [
  { kind: "standard", weekday: 5, onDate: null, start: "10:00", end: "18:00" },
  { kind: "standard", weekday: 6, onDate: null, start: "10:00", end: "18:00" },
]
const SAT = dayNumberForIso("2026-09-12")
const MON = dayNumberForIso("2026-09-14")
const at = (day: number, hhmm: string) => studioWallTimeToInstant(day, hhmm)

test("11:00 on a Saturday is inside standard hours", () => {
  // So an "outside hours" request naming it is claiming something untrue.
  assert.equal(isWithinStandardHours(schedule, SAT, at(SAT, "11:00")), true)
})

test("a closed weekday is outside them, at any hour", () => {
  assert.equal(isWithinStandardHours(schedule, MON, at(MON, "11:00")), false)
})

test("the boundaries: open is inside, close is not", () => {
  // Half-open, so a request for exactly closing time is genuinely outside —
  // nothing can be booked starting then anyway.
  assert.equal(isWithinStandardHours(schedule, SAT, at(SAT, "10:00")), true)
  assert.equal(isWithinStandardHours(schedule, SAT, at(SAT, "17:59")), true)
  assert.equal(isWithinStandardHours(schedule, SAT, at(SAT, "18:00")), false)
  assert.equal(isWithinStandardHours(schedule, SAT, at(SAT, "09:59")), false)
})

test("a no-work block carved out of the day counts as outside", () => {
  const withBreak: Schedule = [
    ...schedule,
    { kind: "no_work", weekday: 5, onDate: null, start: "12:00", end: "13:00" },
  ]
  assert.equal(isWithinStandardHours(withBreak, SAT, at(SAT, "12:30")), false)
  assert.equal(isWithinStandardHours(withBreak, SAT, at(SAT, "11:30")), true)
})

test("an empty schedule puts everything outside — so it fails open", () => {
  // A missing migration degrades getSchedule() to [], and a request must still
  // be accepted rather than refused on the strength of no data.
  assert.equal(isWithinStandardHours([], SAT, at(SAT, "11:00")), false)
})
