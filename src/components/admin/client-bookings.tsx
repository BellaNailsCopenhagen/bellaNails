"use client"

import { useMemo, useState } from "react"
import { CalendarDays, List } from "lucide-react"

import { cn } from "@/lib/utils"
import { Eyebrow, BodySm } from "@/components/ui/typography"
import { CollapsibleSection } from "@/components/admin/collapsible-section"
import {
  CalendarView,
  type DayStateCounts,
} from "@/components/admin/calendar-view"
import {
  ALL_BOOKING_STATES,
  StatusFilter,
} from "@/components/admin/status-filter"
import { QueueBookingCard } from "@/components/admin/queue-booking-card"
import { BookingListRow } from "@/components/admin/booking-list-row"
import {
  bookingState,
  canMarkNoShow,
  type BookingState,
  type DisplayBooking,
} from "@/lib/booking-display"
import {
  dayNumberToMs,
  formatStudioDayMonthYear,
  studioDayNumber,
} from "@/lib/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"
import type { ClientContact } from "@/lib/clerk/contact"

type HistoryView = "list" | "calendar"

const VIEWS = [
  ["list", List, "List"],
  ["calendar", CalendarDays, "Calendar"],
] as const

const endMs = (b: DisplayBooking) => new Date(b.row.end_time).getTime()
const startMs = (b: DisplayBooking) => new Date(b.row.start_time).getTime()

/**
 * A client's booking history: the next appointment expanded on top, then the
 * rest in collapsible Upcoming / History sections, filtered by a multi-select
 * of states. Reuses the shared card + row so a client's bookings read exactly
 * like the queue's.
 */
export function ClientBookings({
  bookings,
  contact,
  clientNoShowCount,
  now,
  photosByBooking = {},
}: {
  bookings: DisplayBooking[]
  contact?: ClientContact
  clientNoShowCount?: number
  now: number
  photosByBooking?: Record<string, { id: string; url: string; kind: string }[]>
}) {
  const [selected, setSelected] = useState<Set<BookingState>>(
    () => new Set(ALL_BOOKING_STATES),
  )
  const [view, setView] = useState<HistoryView>("list")
  const [monthOffset, setMonthOffset] = useState(0)
  // Set by tapping a calendar day — narrows the list to that day; null = all.
  const [focusedDay, setFocusedDay] = useState<number | null>(null)
  const [openUpcoming, setOpenUpcoming] = useState(true)
  const [openHistory, setOpenHistory] = useState(true)

  const showAllDays = () => setFocusedDay(null)
  const focusDay = (day: number) => {
    setFocusedDay(day)
    setView("list")
  }

  const toggleState = (state: BookingState, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(state)
      else next.delete(state)
      return next
    })

  // Next appointment = soonest active (non-cancelled) upcoming booking; the
  // Upcoming section holds the rest so it isn't shown twice.
  const { next, upcoming, past } = useMemo(() => {
    const up = bookings
      .filter((b) => endMs(b) >= now)
      .sort((a, b) => startMs(a) - startMs(b))
    const past = bookings
      .filter((b) => endMs(b) < now)
      .sort((a, b) => startMs(b) - startMs(a))
    const next = up.find((b) => bookingState(b.row, now) === "open")
    return { next, upcoming: up.filter((b) => b !== next), past }
  }, [bookings, now])

  const show = (b: DisplayBooking) =>
    selected.has(bookingState(b.row, now)) &&
    (focusedDay === null || studioDayNumber(startMs(b)) === focusedDay)
  const filteredUpcoming = upcoming.filter(show)
  const filteredPast = past.filter(show)

  // day-number → count, for the calendar's frequency/pattern view. Respects the
  // same state filter as the list.
  const dayCounts = useMemo(() => {
    const counts = new Map<number, DayStateCounts>()
    for (const booking of bookings) {
      const state = bookingState(booking.row, now)
      if (!selected.has(state)) continue
      const day = studioDayNumber(startMs(booking))
      const perState = counts.get(day) ?? {}
      perState[state] = (perState[state] ?? 0) + 1
      counts.set(day, perState)
    }
    return counts
  }, [bookings, selected, now])

  return (
    <div className="space-y-8">
      {next && focusedDay === null ? (
        <div className="space-y-2">
          <Eyebrow as="h3">Next appointment</Eyebrow>
          <QueueBookingCard
            as="div"
            booking={next}
            contact={contact}
            clientNoShowCount={clientNoShowCount}
            noShowEligible={canMarkNoShow(next.row, now)}
            now={now}
            photos={photosByBooking[next.row.id]}
          />
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-0.5 rounded-sm border border-border p-0.5">
          {VIEWS.map(([value, Icon, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setView(value)
                showAllDays()
              }}
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
        <StatusFilter selected={selected} onToggle={toggleState} />
      </div>

      {view === "calendar" ? (
        <CalendarView
          dayCounts={dayCounts}
          now={now}
          offset={monthOffset}
          onOffsetChange={setMonthOffset}
          onSelectDay={focusDay}
        />
      ) : (
        <>
          {focusedDay !== null ? (
            <div className="flex items-center justify-between gap-3">
              <Eyebrow as="span">
                {formatStudioDayMonthYear(dayNumberToMs(focusedDay), ADMIN_LOCALE)}
              </Eyebrow>
              <button
                type="button"
                onClick={showAllDays}
                className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
              >
                Show all
              </button>
            </div>
          ) : null}

          <CollapsibleSection
            label="Upcoming"
            count={filteredUpcoming.length}
            open={openUpcoming}
            onToggle={() => setOpenUpcoming((o) => !o)}
          >
            {filteredUpcoming.length ? (
              <ul>
                {filteredUpcoming.map((booking) => (
                  <BookingListRow
                    key={booking.row.cal_booking_id}
                    booking={booking}
                    contact={contact}
                    clientNoShowCount={clientNoShowCount}
                    upcoming
                    now={now}
                    photos={photosByBooking[booking.row.id]}
                  />
                ))}
              </ul>
            ) : (
              <BodySm className="py-2">Nothing upcoming.</BodySm>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            label="History"
            count={filteredPast.length}
            open={openHistory}
            onToggle={() => setOpenHistory((o) => !o)}
          >
            {filteredPast.length ? (
              <ul>
                {filteredPast.map((booking) => (
                  <BookingListRow
                    key={booking.row.cal_booking_id}
                    booking={booking}
                    contact={contact}
                    clientNoShowCount={clientNoShowCount}
                    upcoming={false}
                    now={now}
                    photos={photosByBooking[booking.row.id]}
                  />
                ))}
              </ul>
            ) : (
              <BodySm className="py-2">No past appointments.</BodySm>
            )}
          </CollapsibleSection>
        </>
      )}
    </div>
  )
}
