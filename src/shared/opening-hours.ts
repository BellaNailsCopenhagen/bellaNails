import { dayRanges, type Schedule } from "@/shared/schedule"
import {
  dayNumberForIso,
  isoForDayNumber,
  subtractRanges,
  unionRanges,
  weekdayIndexForDayNumber,
  type TimeRange,
} from "@/shared/studio-hours"

/**
 * The week as a visitor should read it: every day, in order, open or closed.
 *
 * All seven are returned rather than only the open ones. A salon's week is
 * rarely uniform — a late Thursday, a half Saturday, a Monday off — and a list
 * that silently omits the closed days makes the reader work out which are
 * missing. Saying "Sunday · Closed" costs one line and answers the question.
 *
 * Dated rules are deliberately ignored. A one-off closure next Tuesday is a
 * fact about next Tuesday, not about when the business is open — the booking
 * calendar tells the truth about a specific day, and it already does.
 *
 * Pure + isomorphic: no Intl here, so weekday NAMES stay the caller's problem
 * and this file can't be wrong in one locale.
 */

/** One weekday. 0 = Monday. No ranges = closed. */
export type OpeningDay = {
  weekday: number
  ranges: TimeRange[]
}

const WEEK = 7

/** Bookable ranges for one recurring weekday: standard minus no-work. */
function rangesForWeekday(schedule: Schedule, weekday: number): TimeRange[] {
  const recurring = schedule.filter((rule) => rule.weekday === weekday)
  const standard = unionRanges(
    recurring.filter((r) => r.kind === "standard").map((r) => [r.start, r.end]),
  )
  const off = unionRanges(
    recurring.filter((r) => r.kind === "no_work").map((r) => [r.start, r.end]),
  )
  return off.length ? subtractRanges(standard, off) : standard
}

/** The whole week, Monday first. Always seven entries. */
export function weeklyOpeningDays(schedule: Schedule): OpeningDay[] {
  return Array.from({ length: WEEK }, (_, weekday) => ({
    weekday,
    ranges: rangesForWeekday(schedule, weekday),
  }))
}

/** Is the business ever open on a recurring basis? False means there is nothing
    worth rendering — a table of seven "Closed" rows tells nobody anything. */
export const hasOpeningHours = (schedule: Schedule): boolean =>
  weeklyOpeningDays(schedule).some((day) => day.ranges.length > 0)

/** A day whose hours differ from its weekday's usual pattern — a holiday, a
    one-off closure, an extra Sunday. `label` is the artist's own note. */
export type OpeningException = {
  onDate: string
  closedAllDay: boolean
  ranges: TimeRange[]
  label: string | null
}

/**
 * Upcoming days that don't follow the weekly pattern.
 *
 * An exception is defined by its EFFECT, not by the rule that caused it: a day
 * is listed when its resolved hours differ from what that weekday normally
 * says. So a dated closure shows up, an extra dated opening shows up, and a
 * dated rule that happens to restate the usual hours does not — which is the
 * difference between telling someone something and filling a page with noise.
 */
export function upcomingExceptions(
  schedule: Schedule,
  fromDayNumber: number,
  withinDays: number,
): OpeningException[] {
  const dated = new Set(
    schedule
      .filter((rule) => rule.onDate)
      .map((rule) => dayNumberForIso(rule.onDate as string)),
  )

  const exceptions: OpeningException[] = []
  for (const dayNumber of [...dated].sort((a, b) => a - b)) {
    if (dayNumber < fromDayNumber || dayNumber >= fromDayNumber + withinDays) {
      continue
    }
    const actual = dayRanges(schedule, dayNumber, "standard").ranges
    const usual = rangesForWeekday(schedule, weekdayIndexForDayNumber(dayNumber))
    if (sameRanges(actual, usual)) continue

    exceptions.push({
      onDate: isoForDayNumber(dayNumber),
      closedAllDay: actual.length === 0,
      ranges: actual,
      // Her note, from whichever dated rule carries one.
      label:
        schedule.find(
          (rule) =>
            rule.onDate === isoForDayNumber(dayNumber) && rule.label?.trim(),
        )?.label?.trim() ?? null,
    })
  }
  return exceptions
}

const sameRanges = (a: TimeRange[], b: TimeRange[]): boolean =>
  a.length === b.length &&
  a.every(([start, end], i) => start === b[i][0] && end === b[i][1])
