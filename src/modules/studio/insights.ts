import "server-only"

import { listBookingsBetween } from "@/db/bookings"
import { getBookingSettings } from "@/db/booking-settings"
import { getSchedule } from "@/modules/studio/hours"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"
import { addMonths, monthStartDayNumber } from "@/shared/month-grid"
import {
  capacityMins,
  countsAsEarned,
  countsAsOccupied,
  effectiveIncomeCents,
  footprintMins,
  isIncomeAdjusted,
  occupancyPercent,
  type IncomeBooking,
} from "@/shared/insights"
import {
  dayNumberToMs,
  studioDayNumber,
  studioYearMonth,
} from "@/shared/studio-time"

/**
 * How the studio is doing, month by month — the read behind /admin/insights.
 *
 * Owner-gated by the proxy and read service-role, because it is a studio-wide
 * aggregate rather than anyone's own row. It carries amounts and times only: no
 * name, no contact, nothing that identifies whose appointment earned what.
 */

export type InsightsMonth = {
  /** Sortable studio-month key, and an instant inside it for formatting. */
  key: number
  atMs: number
  appointments: number
  /** How many of those the artist corrected by hand. */
  adjusted: number
  incomeCents: number
  bookedMins: number
  openMins: number
  /** Only the month in progress. Opening hours are not kept historically, so a
      past month would be divided by TODAY's week — a two-day winter measured
      against a five-day spring reads as a failure that never happened. */
  occupancy: number | null
  /** The month is still running, so both figures are to date. */
  inProgress: boolean
}

export type StudioInsights = {
  months: InsightsMonth[]
  bufferMins: number
  loadError: boolean
}

export const EMPTY_INSIGHTS: StudioInsights = {
  months: [],
  bufferMins: 0,
  loadError: false,
}

/** How far back the screen looks. A year is enough to see a season repeat and
    short enough that one read covers it. */
export const INSIGHTS_MONTHS = 12

export async function getStudioInsights(
  now: number,
  monthCount = INSIGHTS_MONTHS,
): Promise<StudioInsights> {
  try {
    const db = createSupabaseServiceRoleClient()
    const base = studioYearMonth(now)
    const first = addMonths(base.year, base.month, -(monthCount - 1))
    const afterLast = addMonths(base.year, base.month, 1)

    const fromDay = monthStartDayNumber(first.year, first.month)
    const toDay = monthStartDayNumber(afterLast.year, afterLast.month)
    // Studio midnight, not UTC midnight: every other line here treats a day
    // number as a Copenhagen date, and a UTC bound clips the local small hours.
    const asIso = (dayNumber: number) =>
      new Date(dayNumberToMs(dayNumber) - 43_200_000).toISOString()

    const [bookings, settings, schedule] = await Promise.all([
      listBookingsBetween(db, asIso(fromDay), asIso(toDay)),
      getBookingSettings(db),
      getSchedule(),
    ])
    const bufferMins = settings?.buffer_mins ?? 0
    const todayDay = studioDayNumber(now)
    const minutesIntoToday = Math.round((now - todayDay * 86_400_000) / 60_000)

    const months: InsightsMonth[] = []
    for (let offset = 0; offset < monthCount; offset++) {
      const { year, month } = addMonths(first.year, first.month, offset)
      const startDay = monthStartDayNumber(year, month)
      const next = addMonths(year, month, 1)
      const endDay = monthStartDayNumber(next.year, next.month)
      const days = Array.from({ length: endDay - startDay }, (_, i) => startDay + i)

      const inMonth = bookings.filter((booking) => {
        const day = studioDayNumber(Date.parse(booking.start_time))
        return day >= startDay && day < endDay
      })
      // Two different questions, so two different sets — an override earns money
      // without taking time, and a no-show takes time without earning money.
      const earned = inMonth.filter((b) => countsAsEarned(b as IncomeBooking, now))
      const occupied = inMonth.filter((b) => countsAsOccupied(b as IncomeBooking, now))

      const inProgress = todayDay >= startDay && todayDay < endDay
      const openMins = capacityMins(schedule, days, todayDay, minutesIntoToday)
      const bookedMins = occupied.reduce(
        (total, booking) => total + footprintMins(booking as IncomeBooking, bufferMins),
        0,
      )

      months.push({
        key: year * 12 + (month - 1),
        atMs: dayNumberToMs(startDay),
        appointments: earned.length,
        adjusted: earned.filter((b) => isIncomeAdjusted(b as IncomeBooking)).length,
        incomeCents: earned.reduce(
          (total, booking) => total + effectiveIncomeCents(booking as IncomeBooking),
          0,
        ),
        bookedMins,
        openMins,
        occupancy: inProgress ? occupancyPercent(bookedMins, openMins) : null,
        inProgress,
      })
    }

    // Newest first: the month she is standing in is the one she came to see.
    return { months: months.reverse(), bufferMins, loadError: false }
  } catch (error) {
    console.error("[insights] read failed", error)
    return { ...EMPTY_INSIGHTS, loadError: true }
  }
}
