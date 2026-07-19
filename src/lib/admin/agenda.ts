import type { DisplayBooking } from "@/lib/booking-display"
import { studioDayNumber, studioWeekStartDayNumber } from "@/lib/studio-time"

/**
 * Groups upcoming bookings into the admin queue's forward agenda: by week
 * (Monday-start, studio timezone) then by day, soonest first. Empty weeks
 * between now and the furthest booking are included so gaps in the calendar
 * are visible; the current week is always present even when empty.
 *
 * Pure and client-safe (studio-time uses Intl), so it can run in an RSC now
 * and move client-side when the realtime increment lands.
 */
export type AgendaDay = {
  /** Studio-local day-number (days since epoch). */
  dayNumber: number
  bookings: DisplayBooking[]
}

export type AgendaWeek = {
  /** Day-number of the week's Monday. */
  weekStartDay: number
  /** True for the week containing `now`. */
  isCurrent: boolean
  /** Weeks from the current one: 0 = this week, 1 = next, … */
  offset: number
  days: AgendaDay[]
  /** Total bookings in the week. */
  count: number
}

const startMs = (b: DisplayBooking) => new Date(b.row.start_time).getTime()

/** How many weeks ahead to render EMPTY weeks (so near-term calendar gaps are
    visible). Beyond this, only weeks with bookings are emitted — a lone
    far-future booking can't spawn a wall of empty weeks. */
const EMPTY_WEEK_HORIZON = 8

export function groupIntoAgenda(
  bookings: DisplayBooking[],
  now: number,
): AgendaWeek[] {
  const currentWeekStart = studioWeekStartDayNumber(studioDayNumber(now))

  // Bucket bookings by week → day, tracking the earliest/latest week seen.
  // minWeekStart can dip below the current week for a boundary-spanning
  // in-progress booking (start last week, end after `now`) — it must still
  // show rather than be dropped.
  const byWeek = new Map<number, Map<number, DisplayBooking[]>>()
  let minWeekStart = currentWeekStart
  let maxWeekStart = currentWeekStart
  for (const booking of bookings) {
    const day = studioDayNumber(startMs(booking))
    const week = studioWeekStartDayNumber(day)
    if (week < minWeekStart) minWeekStart = week
    if (week > maxWeekStart) maxWeekStart = week
    const days = byWeek.get(week) ?? new Map<number, DisplayBooking[]>()
    const list = days.get(day) ?? []
    list.push(booking)
    days.set(day, list)
    byWeek.set(week, days)
  }

  // Emit weeks from the earliest bucket through the furthest booking. Empty
  // weeks appear only within the horizon (so near-term gaps stay visible); a
  // lone far-future booking can't spawn a wall of empty weeks — beyond the
  // horizon only weeks that actually have bookings are emitted.
  const horizonEnd = currentWeekStart + EMPTY_WEEK_HORIZON * 7
  const weeks: AgendaWeek[] = []
  for (let week = minWeekStart; week <= maxWeekStart; week += 7) {
    const days = byWeek.get(week)
    if (!days && week > horizonEnd) continue
    const agendaDays: AgendaDay[] = days
      ? [...days.entries()]
          .sort(([a], [b]) => a - b)
          .map(([dayNumber, list]) => ({
            dayNumber,
            bookings: list.sort((a, b) => startMs(a) - startMs(b)),
          }))
      : []
    weeks.push({
      weekStartDay: week,
      isCurrent: week === currentWeekStart,
      offset: Math.round((week - currentWeekStart) / 7),
      days: agendaDays,
      count: agendaDays.reduce((n, d) => n + d.bookings.length, 0),
    })
  }

  return weeks
}
