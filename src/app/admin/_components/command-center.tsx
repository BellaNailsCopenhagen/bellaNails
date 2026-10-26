import { BookingListRow } from "@/components/admin/booking-list-row"
import { QueueBookingCard } from "@/components/admin/queue-booking-card"
import { Eyebrow, H2, BodySm } from "@/components/ui/typography"
import type { AdminFocus } from "@/modules/booking"
import { canMarkNoShow } from "@/shared/booking-policy"
import { contactDisplayName } from "@/shared/contact"
import {
  formatStudioDate,
  formatStudioTime,
  studioDayNumber,
} from "@/shared/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"

function EmptyPanel({ children }: { children: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-5 text-center">
      <BodySm className="text-sm text-muted-foreground">{children}</BodySm>
    </div>
  )
}

/**
 * The "right now" hero: the booking in progress (open, full card) and the next
 * one (collapsed, taps to expand). A live header says whether the studio is busy
 * or free. Empty states when nothing's on.
 */
export function CommandCenter({
  focus,
  now,
}: {
  focus: AdminFocus
  now: number
}) {
  const { current, next, contacts, noShowCounts, photosByBooking } = focus

  if (focus.loadError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-5">
        <BodySm className="text-sm text-destructive">
          Couldn’t load your schedule — refresh to try again.
        </BodySm>
      </div>
    )
  }

  // Time-only when it's today; prefix the date when it lands on another day, so
  // "Free until 10:00" can't read as today when the next booking is tomorrow.
  const whenLabel = (iso: string) =>
    studioDayNumber(new Date(iso).getTime()) === studioDayNumber(now)
      ? formatStudioTime(iso, ADMIN_LOCALE)
      : `${formatStudioDate(iso, ADMIN_LOCALE)}, ${formatStudioTime(iso, ADMIN_LOCALE)}`

  const heading = current
    ? "In progress"
    : next
      ? "Up next"
      : "Nothing scheduled"
  const subline = current
    ? `${contactDisplayName(contacts[current.row.client_id])} · until ${whenLabel(current.row.end_time)}`
    : next
      ? `Free until ${whenLabel(next.row.start_time)}`
      : "No upcoming appointments."

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Eyebrow>
          {formatStudioDate(new Date(now).toISOString(), ADMIN_LOCALE)}
        </Eyebrow>
        <H2>{heading}</H2>
        <BodySm className="text-xs">{subline}</BodySm>
      </div>

      <section className="space-y-2">
        <Eyebrow as="h3">Now</Eyebrow>
        {current ? (
          <QueueBookingCard
            as="div"
            booking={current}
            contact={contacts[current.row.client_id]}
            clientNoShowCount={noShowCounts[current.row.client_id]}
            noShowEligible={canMarkNoShow(current.row, now)}
            now={now}
            photos={photosByBooking[current.row.id]}
          />
        ) : (
          <EmptyPanel>Nothing in progress right now.</EmptyPanel>
        )}
      </section>

      <section className="space-y-2">
        <Eyebrow as="h3">Next</Eyebrow>
        {next ? (
          <ul className="border-t border-border">
            <BookingListRow
              booking={next}
              contact={contacts[next.row.client_id]}
              clientNoShowCount={noShowCounts[next.row.client_id]}
              upcoming
              now={now}
              photos={photosByBooking[next.row.id]}
            />
          </ul>
        ) : (
          <EmptyPanel>No upcoming appointments.</EmptyPanel>
        )}
      </section>
    </div>
  )
}
