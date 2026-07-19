"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Eyebrow, H2, BodySm } from "@/components/ui/typography"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { QueueBookingCard } from "@/components/admin/queue-booking-card"
import type { AgendaWeek } from "@/lib/admin/agenda"
import {
  dayNumberToMs,
  formatStudioDayMonth,
  formatStudioWeekday,
  studioDayNumber,
} from "@/lib/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"

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
 * The admin queue — a forward agenda grouped by week → day. The current week
 * is expanded by default; future weeks collapse to a header (range + count).
 *
 * Increment 1: static data from the RSC (`weeks`), client-side only for the
 * collapse/expand interaction. Realtime + the Agenda↔Calendar toggle + owner
 * cancel + client contact land in later increments.
 */
export function AdminQueue({
  weeks,
  now,
  loadError = false,
}: {
  weeks: AgendaWeek[]
  now: number
  loadError?: boolean
}) {
  const nowDay = studioDayNumber(now)
  const [open, setOpen] = useState<Set<number>>(
    () => new Set(weeks.filter((w) => w.isCurrent).map((w) => w.weekStartDay)),
  )

  const toggle = (weekStartDay: number) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(weekStartDay)) next.delete(weekStartDay)
      else next.add(weekStartDay)
      return next
    })

  const isEmpty = weeks.every((w) => w.count === 0)

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <Eyebrow>
          {formatStudioWeekday(now, ADMIN_LOCALE)} ·{" "}
          {formatStudioDayMonth(now, ADMIN_LOCALE)}
        </Eyebrow>
        <H2>Queue</H2>
      </div>

      {loadError ? (
        <ErrorState
          title="Couldn’t load the queue"
          body="Something went wrong reaching your bookings. Try again in a moment."
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
                  onClick={() => toggle(week.weekStartDay)}
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
                        <div key={day.dayNumber} className="space-y-3">
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
