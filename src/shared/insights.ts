import { bookedDurationMins } from "@/shared/booking-policy"
import { isActiveBookingStatus } from "@/shared/booking-status"
import { dayRanges, type Schedule } from "@/shared/schedule"
import { toMinutes, type TimeRange } from "@/shared/studio-hours"

/**
 * The studio's own numbers — what came in, and how much of the open week it took
 * to earn. Pure arithmetic over amounts and times; no client, no PII.
 *
 * INFORMATION ONLY. These figures come from stored booking totals and the
 * artist's own corrections. They know nothing about Stripe fees, VAT, tips paid
 * in cash, or anything settled off the system, and they are not an accounting
 * record. The screen says so and this file exists to keep that honest.
 */

/** The minimum a booking has to carry for any of this to apply. */
export type IncomeBooking = {
  start_time: string
  end_time: string
  status: string
  total_price_cents: number | null
  income_override_cents: number | null
  no_show_at: string | null
  selected_addons: unknown
}

/**
 * What an appointment actually earned.
 *
 * `??`, never `||`: a 0 override is a real answer — refunded, or never charged —
 * and falling back to the booked price there would quietly re-earn money that
 * was given back.
 */
export function effectiveIncomeCents(booking: IncomeBooking): number {
  return booking.income_override_cents ?? booking.total_price_cents ?? 0
}

/** Has the artist corrected this one by hand? Drives the "adjusted" marker, so
    a figure that disagrees with the booked price always says why. */
export const isIncomeAdjusted = (booking: IncomeBooking): boolean =>
  booking.income_override_cents !== null

/** Over and done: the time has passed and the appointment still stands. */
const hasHappened = (booking: IncomeBooking, now: number): boolean =>
  Date.parse(booking.end_time) <= now && isActiveBookingStatus(booking.status)

/**
 * Does this appointment count toward the period's income?
 *
 * Earned means it happened, it still stands, and somebody turned up. A no-show
 * keeps an active `status` on purpose — the marker is ours and clients never see
 * it — so without that clause every missed appointment would report its full
 * booked price as money the studio took.
 *
 * An explicit correction always counts, whatever the appointment did. That is
 * what makes the override worth having: a no-show fee she actually charged is
 * captured, and a refunded appointment can be zeroed rather than quietly staying
 * at its booked price.
 */
export function countsAsEarned(booking: IncomeBooking, now: number): boolean {
  if (isIncomeAdjusted(booking)) return true
  return hasHappened(booking, now) && booking.no_show_at === null
}

/**
 * Does this appointment count toward the period's OCCUPANCY?
 *
 * A different question from income, and it separates for two reasons. A no-show
 * still BLOCKED the slot — she could not sell that hour to anyone else — so it
 * occupied the week even though it earned nothing; occupancy high against income
 * low is exactly how a no-show problem should look. And an override earns money
 * without taking time: a deposit on next month's appointment, or a fee on a slot
 * that was cancelled and freed, must never be counted as hours worked.
 */
export function countsAsOccupied(booking: IncomeBooking, now: number): boolean {
  return hasHappened(booking, now)
}

/**
 * The time an appointment really costs the day: its length plus the turnaround
 * after it. The calendar blocks that buffer, so a schedule packed to the buffer
 * is a full one — measuring duration alone would report spare capacity that
 * cannot be sold.
 */
export function footprintMins(booking: IncomeBooking, bufferMins: number): number {
  const booked = bookedDurationMins(booking)
  const span =
    (Date.parse(booking.end_time) - Date.parse(booking.start_time)) / 60000
  const duration = booked > 0 ? booked : Math.max(0, Math.round(span))
  return duration + bufferMins
}

const rangeMins = (ranges: TimeRange[]): number =>
  ranges.reduce((total, [from, to]) => total + (toMinutes(to) - toMinutes(from)), 0)

/**
 * Open minutes across a run of days — occupancy's denominator, straight from the
 * schedule the artist keeps.
 *
 * Only time that has already PASSED counts. A month-to-date figure measured
 * against the whole month reads as failure every time you look at it on the 3rd
 * — and today counts only up to this minute, or a fully booked Monday would read
 * as a slack one at nine in the morning and climb all day.
 */
export function capacityMins(
  schedule: Schedule,
  dayNumbers: number[],
  todayDayNumber: number,
  /** Minutes past studio midnight, right now. */
  minutesIntoToday: number,
): number {
  return dayNumbers
    .filter((day) => day <= todayDayNumber)
    .reduce((total, day) => {
      const { ranges } = dayRanges(schedule, day, "standard")
      if (day < todayDayNumber) return total + rangeMins(ranges)
      // Today: clamp every open range to the part already behind us.
      return (
        total +
        ranges.reduce((mins, [from, to]) => {
          const start = toMinutes(from)
          const end = Math.min(toMinutes(to), minutesIntoToday)
          return mins + Math.max(0, end - start)
        }, 0)
      )
    }, 0)
}

/**
 * Share of the open week that was booked, 0-100.
 *
 * Null for the two cases that are not a percentage: no hours were open, and —
 * for a past month nobody was watching — nobody knows how many were. Both must
 * read as "no answer" rather than 0%, which would look like a catastrophic month
 * instead of a missing measurement.
 */
export function occupancyPercent(
  bookedMins: number,
  openMins: number | null,
): number | null {
  if (openMins === null || openMins <= 0) return null
  return Math.round((bookedMins / openMins) * 100)
}

/** A studio month, as the sortable key the snapshots are stored under. */
export const monthKey = (year: number, month: number): number =>
  year * 12 + (month - 1)

/**
 * The span of months a read has to cover — first and last of what needs working
 * out. With every snapshot in place that is the current month alone, which is
 * the whole point: one month of appointments instead of a year of them.
 */
export function computeSpan(
  keysToCompute: number[],
): { fromKey: number; toKey: number } | null {
  if (!keysToCompute.length) return null
  return {
    fromKey: Math.min(...keysToCompute),
    toKey: Math.max(...keysToCompute),
  }
}
