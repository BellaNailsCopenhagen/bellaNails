"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/shared/cn"
import { Badge } from "@/components/ui/badge"
import { QueueBookingCard } from "@/components/admin/queue-booking-card"
import { BOOKING_STATUS } from "@/shared/booking-status"
import {
  type DisplayBooking,
} from "@/shared/booking-view"
import {
  canMarkNoShow,
} from "@/shared/booking-policy"
import { contactDisplayName, type ClientContact } from "@/lib/identity/contact"
import { formatStudioDayMonthYear, formatStudioTime } from "@/shared/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"

type StatusBadge = {
  label: string
  variant: "success" | "warning" | "destructive"
}

/** Cancelled wins; otherwise past = completed, upcoming-rescheduled = moved,
    upcoming-confirmed shows nothing (the section header says "Upcoming"). */
function statusBadge(
  upcoming: boolean,
  status: string,
  noShow: boolean,
): StatusBadge | null {
  if (status === BOOKING_STATUS.cancelled)
    return { label: "Cancelled", variant: "destructive" }
  // A no-show is more specific than "completed" — surface it in the summary.
  if (noShow) return { label: "No-show", variant: "destructive" }
  if (!upcoming) return { label: "Completed", variant: "success" }
  if (status === BOOKING_STATUS.rescheduled)
    return { label: "Rescheduled", variant: "warning" }
  return null
}

/**
 * A booking in the Bookings browse: a condensed one-line summary that expands
 * to the full card. Reschedule/cancel are shown only for upcoming, non-cancelled
 * bookings (via the card's `actionable` prop).
 */
export function BookingListRow({
  booking,
  contact,
  clientNoShowCount,
  upcoming,
  now,
  photos,
}: {
  booking: DisplayBooking
  contact?: ClientContact
  clientNoShowCount?: number
  upcoming: boolean
  now: number
  photos?: { id: string; url: string; kind: string }[]
}) {
  const [open, setOpen] = useState(false)
  const { row } = booking
  const startMs = new Date(row.start_time).getTime()
  const badge = statusBadge(upcoming, row.status, Boolean(row.no_show_at))
  const actionable = upcoming && row.status !== BOOKING_STATUS.cancelled

  return (
    <li className="border-b border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 py-3 text-left"
      >
        <div className="min-w-0">
          <p className="truncate font-functional text-sm text-foreground">
            {contactDisplayName(contact)} · {booking.serviceName ?? "Session"}
          </p>
          <p className="font-functional text-xs text-muted-foreground">
            {formatStudioDayMonthYear(startMs, ADMIN_LOCALE)} ·{" "}
            {formatStudioTime(row.start_time, ADMIN_LOCALE)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {badge ? (
            <Badge variant={badge.variant} size="xs">
              {badge.label}
            </Badge>
          ) : null}
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </div>
      </button>

      {open ? (
        <div className="pb-3">
          <QueueBookingCard
            as="div"
            booking={booking}
            contact={contact}
            clientNoShowCount={clientNoShowCount}
            actionable={actionable}
            noShowEligible={canMarkNoShow(row, now)}
            now={now}
            photos={photos}
          />
        </div>
      ) : null}
    </li>
  )
}
