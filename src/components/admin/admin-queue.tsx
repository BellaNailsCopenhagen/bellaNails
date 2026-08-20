"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { CalendarDays, ChevronDown, List } from "lucide-react"

import { cn } from "@/shared/cn"
import { Eyebrow, H2, BodySm } from "@/components/ui/typography"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { QueueBookingCard } from "@/components/admin/queue-booking-card"
import type { BookingThumb } from "@/shared/booking-view"
import { QueueRealtime } from "@/components/admin/queue-realtime"
import {
  CalendarView,
  type DayStateCounts,
} from "@/components/admin/calendar-view"
import {
  bookingState,
  canMarkNoShow,
} from "@/shared/booking-policy"
import type { AgendaWeek } from "@/shared/booking-agenda"
import type { ClientContact } from "@/lib/identity/contact"
import {
  dayNumberToMs,
  formatStudioDayMonth,
  formatStudioWeekday,
  studioDayNumber,
  studioWeekStartDayNumber,
} from "@/shared/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"

type QueueView = "agenda" | "calendar"

const VIEWS = [
  ["agenda", List, "Agenda"],
  ["calendar", CalendarDays, "Calendar"],
] as const

function weekLabel(week: AgendaWeek): string {
  if (week.offset === 0) return "This week"
  if (week.offset === 1) return "Next week"
  return `Week of ${formatStudioDayMonth(dayNumberToMs(week.weekStartDay), ADMIN_LOCALE)}`
}

function dayLabel(dayNumber: number, nowDay: number): string {
  if (dayNumber === nowDay) return "Today"
  if (dayNumber === nowDay + 1) return "Tomorrow"
  return formatStudioWeekday(dayNumberToMs(dayNumber), ADMIN_LOCALE)
}

function countLabel(count: number): string {
  if (count === 0) return "open"
  return `${count} ${count === 1 ? "appointment" : "appointments"}`
}

/**
 * The admin queue — a forward agenda grouped by week → day, with a toggle to a
 * condensed month calendar. The current week is expanded by default; future
 * weeks collapse. Tapping a day in the calendar jumps back into the agenda,
 * scrolled to (and expanding) that day.
 *
 * Increment 1+3: static data from the RSC (`weeks`); client-side for
 * collapse/expand + view switching. Realtime lands in a later increment.
 */
export function AdminQueue({
  weeks,
  contacts,
  noShowCounts,
  now,
  photosByBooking = {},
  loadError = false,
}: {
  weeks: AgendaWeek[]
  contacts: Record<string, ClientContact>
  noShowCounts: Record<string, number>
  now: number
  photosByBooking?: Record<string, BookingThumb[]>
  loadError?: boolean
}) {
  const nowDay = studioDayNumber(now)
  const [view, setView] = useState<QueueView>("agenda")
  // Owned here (not in CalendarView) so the browsed month survives toggling.
  const [monthOffset, setMonthOffset] = useState(0)
  const [open, setOpen] = useState<Set<number>>(
    () => new Set(weeks.filter((w) => w.isCurrent).map((w) => w.weekStartDay)),
  )
  // A pending day to scroll to after a calendar → agenda jump. A ref (not
  // state) so clearing it doesn't trigger a re-render inside the effect.
  const scrollTargetRef = useRef<number | null>(null)

  // day-number → per-state booking counts, for the calendar. Booking days are
  // always emitted in `weeks` (only empty far weeks are dropped), so complete.
  const dayCounts = useMemo(() => {
    const counts = new Map<number, DayStateCounts>()
    for (const week of weeks) {
      for (const day of week.days) {
        const perState: DayStateCounts = {}
        for (const booking of day.bookings) {
          const state = bookingState(booking.row, now)
          perState[state] = (perState[state] ?? 0) + 1
        }
        counts.set(day.dayNumber, perState)
      }
    }
    return counts
  }, [weeks, now])

  const toggleWeek = (weekStartDay: number) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(weekStartDay)) next.delete(weekStartDay)
      else next.add(weekStartDay)
      return next
    })

  // From the calendar: open the day's week, switch to the agenda, scroll to it.
  // selectDay always runs from the calendar view, so `view` transitions to
  // "agenda" and the effect below fires.
  const selectDay = (dayNumber: number) => {
    setOpen((prev) => new Set(prev).add(studioWeekStartDayNumber(dayNumber)))
    scrollTargetRef.current = dayNumber
    setView("agenda")
  }

  useEffect(() => {
    if (view !== "agenda" || scrollTargetRef.current === null) return
    const dayNumber = scrollTargetRef.current
    scrollTargetRef.current = null
    document
      .getElementById(`admin-day-${dayNumber}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [view])

  const isEmpty = weeks.every((w) => w.count === 0)

  return (
    <div className="space-y-8">
      <QueueRealtime />
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <Eyebrow>
            {formatStudioWeekday(now, ADMIN_LOCALE)} ·{" "}
            {formatStudioDayMonth(now, ADMIN_LOCALE)}
          </Eyebrow>
          <H2>Queue</H2>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/appointments"
            className="font-functional text-xs uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
          >
            Appointments
          </Link>
          <div className="flex items-center gap-0.5 rounded-sm border border-border p-0.5">
            {VIEWS.map(([value, Icon, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setView(value)}
              aria-pressed={view === value}
              aria-label={label}
              className={cn(
                "flex size-8 items-center justify-center rounded-[2px] transition-colors",
                view === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
            </button>
          ))}
          </div>
        </div>
      </div>

      {loadError ? (
        <ErrorState
          title="Couldn’t load the queue"
          body="Something went wrong reaching your bookings. Try again in a moment."
        />
      ) : view === "calendar" ? (
        <CalendarView
          dayCounts={dayCounts}
          now={now}
          offset={monthOffset}
          onOffsetChange={setMonthOffset}
          onSelectDay={selectDay}
        />
      ) : isEmpty ? (
        <EmptyState
          title="Nothing booked"
          body="Your upcoming appointments will appear here, grouped by week."
        />
      ) : (
        <div className="space-y-4">
          {weeks.map((week) => {
            const isOpen = open.has(week.weekStartDay)
            return (
              <section key={week.weekStartDay}>
                <button
                  type="button"
                  onClick={() => toggleWeek(week.weekStartDay)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 border-b border-border py-3 text-left"
                >
                  <span className="font-editorial text-lg text-foreground">
                    {weekLabel(week)}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground">
                      {countLabel(week.count)}
                    </span>
                    <ChevronDown
                      className={cn(
                        "size-4 text-muted-foreground transition-transform",
                        isOpen && "rotate-180",
                      )}
                    />
                  </span>
                </button>

                {isOpen ? (
                  week.count === 0 ? (
                    <BodySm className="py-4">Nothing booked this week.</BodySm>
                  ) : (
                    <div className="space-y-6 pt-4">
                      {week.days.map((day) => (
                        <div
                          key={day.dayNumber}
                          id={`admin-day-${day.dayNumber}`}
                          className="scroll-mt-20 space-y-3"
                        >
                          <Eyebrow>
                            {dayLabel(day.dayNumber, nowDay)} ·{" "}
                            {formatStudioDayMonth(
                              dayNumberToMs(day.dayNumber),
                              ADMIN_LOCALE,
                            )}
                          </Eyebrow>
                          <ul className="space-y-3">
                            {day.bookings.map((booking) => (
                              <QueueBookingCard
                                key={booking.row.cal_booking_id}
                                booking={booking}
                                contact={contacts[booking.row.client_id]}
                                clientNoShowCount={
                                  noShowCounts[booking.row.client_id]
                                }
                                noShowEligible={canMarkNoShow(booking.row, now)}
                                now={now}
                                photos={photosByBooking[booking.row.id]}
                              />
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )
                ) : null}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
