// The unified schedule model + resolver. Pure + isomorphic (client editor and
// server slot engine both use it). One rule = a standard / outside / no-work
// block, recurring on a weekday or one-off on a date. Replaces the old
// weekly-hours + no-work + outer-window + special-days split.

import {
  isoForDayNumber,
  subtractRanges,
  unionRanges,
  weekdayIndexForDayNumber,
  type DayHours,
  type TimeRange,
} from "@/shared/studio-hours"

export type ScheduleKind = "standard" | "outside" | "no_work"

export const SCHEDULE_KINDS: ScheduleKind[] = ["standard", "outside", "no_work"]

/** One admin-facing label per kind — the single source, so the stepper and the
    calendar legend can't drift apart. (`standard`/`no_work` are the stored kinds;
    these are just what the artist reads.) */
export const SCHEDULE_KIND_LABEL: Record<ScheduleKind, string> = {
  standard: "Working hours",
  outside: "Outside hours",
  no_work: "Off",
}

/** One schedule rule. Exactly one of `weekday` (recurring 0=Mon..6=Sun) or
    `onDate` (a single YYYY-MM-DD) is set. */
export type ScheduleRule = {
  id?: string
  kind: ScheduleKind
  weekday: number | null
  onDate: string | null
  start: string // "HH:MM"
  end: string // "HH:MM"
  label?: string | null
}

export type Schedule = ScheduleRule[]

function ruleAppliesOn(rule: ScheduleRule, dayNumber: number): boolean {
  return rule.weekday !== null
    ? rule.weekday === weekdayIndexForDayNumber(dayNumber)
    : rule.onDate === isoForDayNumber(dayNumber)
}

const rangesOf = (rules: ScheduleRule[]): TimeRange[] =>
  rules.map((r) => [r.start, r.end])

/**
 * Effective bookable ranges for one day-number, per mode. The one hierarchy,
 * applied everywhere:
 *   standard = union(standard) − no_work
 *   outside  = union(outside) − no_work − standard   (a standard time is booked
 *              normally, so it's never offered as a request)
 */
export function dayRanges(
  schedule: Schedule,
  dayNumber: number,
  mode: "standard" | "outside",
): DayHours {
  // Standard is exactly standardDay().effective — one definition of "bookable".
  if (mode === "standard") {
    const ranges = standardDay(schedule, dayNumber).effective
    return { closed: ranges.length === 0, ranges }
  }
  const applies = schedule.filter((r) => ruleAppliesOn(r, dayNumber))
  const noWork = rangesOf(applies.filter((r) => r.kind === "no_work"))
  const outside = unionRanges(rangesOf(applies.filter((r) => r.kind === "outside")))
  const standard = rangesOf(applies.filter((r) => r.kind === "standard"))
  const ranges = subtractRanges(outside, [...noWork, ...standard])
  return { closed: ranges.length === 0, ranges }
}

/**
 * For the conflict check: the raw standard union (before no-work) and the
 * effective standard (after no-work) on a day. Lets the classifier say WHY a
 * booking no longer fits — closed (no standard that day) / no_work (in the raw
 * standard but carved out) / outside_hours (not standard at all).
 */
export function standardDay(
  schedule: Schedule,
  dayNumber: number,
): { raw: TimeRange[]; effective: TimeRange[] } {
  const applies = schedule.filter((r) => ruleAppliesOn(r, dayNumber))
  const raw = unionRanges(rangesOf(applies.filter((r) => r.kind === "standard")))
  const noWork = rangesOf(applies.filter((r) => r.kind === "no_work"))
  return { raw, effective: subtractRanges(raw, noWork) }
}
