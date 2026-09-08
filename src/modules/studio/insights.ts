import "server-only"

import { listBookingsBetween } from "@/db/bookings"
import { getBookingSettings } from "@/db/booking-settings"
import type { Insert } from "@/db/client"
import {
  listInsightsMonths,
  upsertInsightsMonths,
  type InsightsMonthRow,
} from "@/db/insights-months"
import { getSchedule } from "@/modules/studio/hours"
import { addMonths, monthStartDayNumber } from "@/shared/month-grid"
import {
  capacityMins,
  computeSpan,
  countsAsEarned,
  countsAsOccupied,
  effectiveIncomeCents,
  footprintMins,
  isIncomeAdjusted,
  monthKey,
  occupancyPercent,
  type IncomeBooking,
} from "@/shared/insights"
import {
  dayNumberToMs,
  studioDayNumber,
  studioYearMonth,
} from "@/shared/studio-time"
import type { Schedule } from "@/shared/schedule"
import { requireOwner } from "@/modules/identity/require-owner"

/**
 * How the studio is doing, month by month — the read behind /admin/insights.
 *
 * A CLOSED month is read from its frozen snapshot and only computed when one is
 * missing. That is not mainly about speed: recomputing history lets the schedule
 * rewrite a past month's occupancy and an erasure request shrink its income,
 * long after the month ended. Freezing it is what makes a past figure worth
 * showing at all. The month in progress is always live, because it is changing.
 *
 * Owner-gated by the proxy and read service-role: a studio-wide aggregate of
 * amounts and minutes, with no name, no contact, nothing identifying whose
 * appointment earned what.
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
  /** The month's open minutes as they WERE. Null when nobody captured them —
      the month ended before this was kept, or she never opened the screen during
      it. Recomputing them from today's schedule would be a guess wearing a
      number's clothes. */
  openMins: number | null
  /** Null when the open hours are unknown, or when there were none — a share of
      no hours is not 0%, it is not a question. */
  occupancy: number | null
  /** The month is still running, so both figures are to date. */
  inProgress: boolean
}

export type StudioInsights = {
  months: InsightsMonth[]
  bufferMins: number
  /** The snapshot table isn't there yet — everything was computed live. */
  snapshotsUnavailable: boolean
  loadError: boolean
}

export const EMPTY_INSIGHTS: StudioInsights = {
  months: [],
  bufferMins: 0,
  snapshotsUnavailable: false,
  loadError: false,
}

/** How far back the screen looks. A year is enough to see a season repeat. */
export const INSIGHTS_MONTHS = 12

/** The raw figures for one month, before they become a row or a view model. */
type MonthTotals = {
  appointments: number
  adjusted: number
  incomeCents: number
  bookedMins: number
}

function computeMonth(params: {
  bookings: IncomeBooking[]
  startDay: number
  endDay: number
  bufferMins: number
  now: number
}): MonthTotals {
  const { bookings, startDay, endDay, now, bufferMins } = params
  const inMonth = bookings.filter((booking) => {
    const day = studioDayNumber(Date.parse(booking.start_time))
    return day >= startDay && day < endDay
  })
  // Two different questions, so two different sets — an override earns money
  // without taking time, and a no-show takes time without earning money.
  const earned = inMonth.filter((booking) => countsAsEarned(booking, now))
  const occupied = inMonth.filter((booking) => countsAsOccupied(booking, now))

  return {
    appointments: earned.length,
    adjusted: earned.filter(isIncomeAdjusted).length,
    incomeCents: earned.reduce(
      (total, booking) => total + effectiveIncomeCents(booking),
      0,
    ),
    bookedMins: occupied.reduce(
      (total, booking) => total + footprintMins(booking, bufferMins),
      0,
    ),
  }
}

/** Open minutes across a whole month, from the schedule as it stands NOW. Only
    ever called for the month in progress — that is when "now" is the truth. */
function monthCapacity(
  schedule: Schedule,
  startDay: number,
  endDay: number,
  upToDay: number,
  minutesIntoToday: number,
): number {
  const days = Array.from({ length: endDay - startDay }, (_, i) => startDay + i)
  return capacityMins(schedule, days, upToDay, minutesIntoToday)
}

const toMonth = (
  key: number,
  startDay: number,
  totals: MonthTotals,
  openMins: number | null,
  inProgress: boolean,
): InsightsMonth => ({
  key,
  atMs: dayNumberToMs(startDay),
  ...totals,
  openMins,
  occupancy: occupancyPercent(totals.bookedMins, openMins),
  inProgress,
})

export async function getStudioInsights(
  now: number,
  monthCount = INSIGHTS_MONTHS,
): Promise<StudioInsights> {
  try {
    const db = await requireOwner()
    if (!db) return EMPTY_INSIGHTS
    const base = studioYearMonth(now)
    const first = addMonths(base.year, base.month, -(monthCount - 1))
    const currentKey = monthKey(base.year, base.month)
    const firstKey = monthKey(first.year, first.month)

    const stored = await listInsightsMonths(db, firstKey, currentKey)
    const snapshots = new Map<number, InsightsMonthRow>(
      (stored ?? []).map((row) => [row.month_key, row]),
    )

    const wanted = Array.from({ length: monthCount }, (_, offset) =>
      addMonths(first.year, first.month, offset),
    )
    // A closed month needs working out when nothing is stored for it, or when
    // its money was marked stale. The month in progress always does.
    const needsWork = (key: number) => {
      if (key === currentKey) return true
      const row = snapshots.get(key)
      return !row || row.stale
    }
    const needed = new Set(
      wanted.map(({ year, month }) => monthKey(year, month)).filter(needsWork),
    )
    const toCompute = [...needed].sort((a, b) => a - b)

    const todayDay = studioDayNumber(now)
    const minutesIntoToday = Math.round((now - todayDay * 86_400_000) / 60_000)
    const dayOfKey = (key: number) =>
      monthStartDayNumber(Math.floor(key / 12), (key % 12) + 1)
    const asIso = (dayNumber: number) =>
      new Date(dayNumberToMs(dayNumber) - 43_200_000).toISOString()

    const span = computeSpan(toCompute)
    const [bookingRows, settings, schedule] = await Promise.all([
      span
        ? listBookingsBetween(
            db,
            asIso(dayOfKey(span.fromKey)),
            asIso(dayOfKey(span.toKey + 1)),
          )
        : Promise.resolve([]),
      getBookingSettings(db),
      getSchedule(),
    ])
    const bookings = bookingRows as IncomeBooking[]
    const bufferMins = settings?.buffer_mins ?? 0

    const months: InsightsMonth[] = []
    const toStore: Insert<"insights_months">[] = []

    for (const { year, month } of wanted) {
      const key = monthKey(year, month)
      const startDay = monthStartDayNumber(year, month)
      const next = addMonths(year, month, 1)
      const endDay = monthStartDayNumber(next.year, next.month)
      const inProgress = todayDay >= startDay && todayDay < endDay
      const row = snapshots.get(key)

      if (!needed.has(key) && row) {
        months.push(
          toMonth(
            key,
            startDay,
            {
              appointments: row.appointments,
              adjusted: row.adjusted,
              incomeCents: row.income_cents,
              bookedMins: row.booked_mins,
            },
            row.open_mins,
            false,
          ),
        )
        continue
      }

      const totals = computeMonth({ bookings, startDay, endDay, bufferMins, now })

      if (inProgress) {
        // The one month whose hours we can still see truthfully. Displayed
        // against the hours ELAPSED, and stored as the whole month's, so that
        // when it closes the figure kept is the week she actually kept.
        const elapsed = monthCapacity(
          schedule,
          startDay,
          endDay,
          todayDay,
          minutesIntoToday,
        )
        months.push(toMonth(key, startDay, totals, elapsed, true))
        toStore.push({
          month_key: key,
          appointments: totals.appointments,
          adjusted: totals.adjusted,
          income_cents: totals.incomeCents,
          booked_mins: totals.bookedMins,
          open_mins: monthCapacity(schedule, startDay, endDay, endDay, 0),
          // STALE by definition. The row exists to capture this month's opening
          // hours while they are still true; its money is only as complete as
          // today. Without this flag the last mid-month read would become the
          // month's final figure, missing everything booked after it.
          stale: true,
          computed_at: new Date(now).toISOString(),
        })
        continue
      }

      // A closed month: keep whatever hours were captured for it, and never
      // invent them. A stale row keeps its own; a month nobody watched has none.
      const openMins = row?.open_mins ?? null
      months.push(toMonth(key, startDay, totals, openMins, false))
      if (todayDay >= endDay) {
        toStore.push({
          month_key: key,
          appointments: totals.appointments,
          adjusted: totals.adjusted,
          income_cents: totals.incomeCents,
          booked_mins: totals.bookedMins,
          open_mins: openMins,
          stale: false,
          computed_at: new Date(now).toISOString(),
        })
      }
    }

    // Best effort: a page that renders the right numbers must not fail because
    // it could not keep them.
    if (toStore.length && stored !== null) {
      await upsertInsightsMonths(db, toStore)
    }

    // Newest first: the month she is standing in is the one she came to see.
    return {
      months: months.reverse(),
      bufferMins,
      snapshotsUnavailable: stored === null,
      loadError: false,
    }
  } catch (error) {
    console.error("[insights] read failed", error)
    return { ...EMPTY_INSIGHTS, loadError: true }
  }
}

/** The month a booking's start falls in — what an edit has to invalidate. */
export function monthKeyOf(startIso: string): number {
  const { year, month } = studioYearMonth(Date.parse(startIso))
  return monthKey(year, month)
}
