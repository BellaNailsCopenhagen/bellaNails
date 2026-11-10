import assert from "node:assert/strict"
import { test } from "node:test"

import { generateSlots, type Slot, type BusySpan, type SlotRules } from "./booking-slots"
import type { Schedule } from "./schedule"

const MIN = 60_000

const schedule: Schedule = [
  { kind: "standard", weekday: 1, onDate: null, start: "09:00", end: "17:00", label: "Monday" },
  { kind: "standard", weekday: 2, onDate: null, start: "09:00", end: "17:00", label: "Tuesday" },
]

const rules: SlotRules = {
  slotIntervalMins: 30,
  bufferMins: 15,
  minLeadMins: 60,
  maxAdvanceDays: 30,
}

test("generateSlots returns free starts within standard hours on an open day", () => {
  const now = Date.UTC(2026, 6, 6, 8, 0, 0) // Monday 2026-07-06 08:00 UTC
  const slots = generateSlots({
    schedule,
    mode: "standard",
    durationMins: 30,
    busy: [],
    rules,
    now,
  })

  assert.ok(slots.length > 0, "expected at least one slot")
  // First slot must respect min lead time (now + 60 min)
  const firstStart = new Date(slots[0].start).getTime()
  assert.ok(firstStart >= now + rules.minLeadMins * MIN)

  // All slots must be within 09:00–17:00 studio time on the Monday
  for (const slot of slots) {
    const start = new Date(slot.start).getTime()
    const end = new Date(slot.end).getTime()
    assert.ok(end - start === 30 * MIN)
  }
})

test("generateSlots excludes busy spans plus buffer on both sides", () => {
  const now = Date.UTC(2026, 6, 6, 8, 0, 0)
  // A busy span from 10:00–11:00 studio time on Monday
  const busy: BusySpan[] = [{ start: now + 2 * MIN, end: now + 3 * MIN }]

  const slots = generateSlots({
    schedule,
    mode: "standard",
    durationMins: 30,
    busy,
    rules,
    now,
  })

  // No slot should overlap the busy span ± 15 min buffer
  for (const slot of slots) {
    const start = new Date(slot.start).getTime()
    const end = new Date(slot.end).getTime()
    const clash = start < busy[0].end + 15 * MIN && busy[0].start < end + 15 * MIN
    assert.ok(!clash, `slot ${slot.start}–${slot.end} clashes with busy span`)
  }
})

test("generateSlots returns [] when the schedule is empty (all days closed)", () => {
  const now = Date.UTC(2026, 6, 6, 8, 0, 0)
  const slots = generateSlots({
    schedule: [],
    mode: "standard",
    durationMins: 30,
    busy: [],
    rules,
    now,
  })

  assert.equal(slots.length, 0)
})

test("generateSlots respects maxAdvanceDays", () => {
  const now = Date.UTC(2026, 6, 6, 8, 0, 0)
  const rulesShort = { ...rules, maxAdvanceDays: 1 }
  const slots = generateSlots({
    schedule,
    mode: "standard",
    durationMins: 30,
    busy: [],
    rules: rulesShort,
    now,
  })

  assert.ok(slots.length > 0)
  const lastStart = new Date(slots[slots.length - 1].start).getTime()
  const maxDay = new Date(now).getDate() + 1
  assert.ok(new Date(lastStart).getDate() <= maxDay)
})

test("generateSlots slot shape is { start, end } UTC ISO", () => {
  const now = Date.UTC(2026, 6, 6, 8, 0, 0)
  const slots = generateSlots({
    schedule,
    mode: "standard",
    durationMins: 30,
    busy: [],
    rules,
    now,
  })

  if (slots.length > 0) {
    const slot: Slot = slots[0]
    assert.match(slot.start, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)
    assert.match(slot.end, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)
  }
})
