"use client"

import { useMemo, useState } from "react"

import { Eyebrow, BodySm } from "@/components/ui/typography"
import { CollapsibleSection } from "@/components/admin/collapsible-section"
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
import type { ClientContact } from "@/lib/clerk/contact"

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
}: {
  bookings: DisplayBooking[]
  contact?: ClientContact
  clientNoShowCount?: number
  now: number
}) {
  const [selected, setSelected] = useState<Set<BookingState>>(
    () => new Set(ALL_BOOKING_STATES),
  )
  const [openUpcoming, setOpenUpcoming] = useState(true)
  const [openHistory, setOpenHistory] = useState(true)

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

  const show = (b: DisplayBooking) => selected.has(bookingState(b.row, now))
  const filteredUpcoming = upcoming.filter(show)
  const filteredPast = past.filter(show)

  return (
    <div className="space-y-8">
      {next ? (
        <div className="space-y-2">
          <Eyebrow as="h3">Next appointment</Eyebrow>
          <QueueBookingCard
            as="div"
            booking={next}
            contact={contact}
            clientNoShowCount={clientNoShowCount}
            noShowEligible={canMarkNoShow(next.row, now)}
          />
        </div>
      ) : null}

      <div className="flex justify-end">
        <StatusFilter selected={selected} onToggle={toggleState} />
      </div>

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
              />
            ))}
          </ul>
        ) : (
          <BodySm className="py-2">No past appointments.</BodySm>
        )}
      </CollapsibleSection>
    </div>
  )
}
