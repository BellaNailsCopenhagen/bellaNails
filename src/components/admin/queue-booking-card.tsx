import { Badge } from "@/components/ui/badge"
import { PriceTag } from "@/components/ui/price-tag"
import { TintedCard } from "@/components/ui/tinted-card"
import { BOOKING_STATUS } from "@/lib/booking-status"
import type { DisplayBooking } from "@/lib/booking-display"
import { formatStudioTime } from "@/lib/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"

/**
 * A booking in the admin queue — condensed vs the client's card. English-only
 * (the admin has no next-intl context), reusing the shared display shapes.
 *
 * Increment 1: time · service · add-ons · note · price · duration, plus a
 * "rescheduled" chip (studio cares even though clients don't see it). Client
 * name/contact and cancel land in later increments — the layout leaves room
 * (a right column for actions, a header row for the name).
 */
export function QueueBookingCard({ booking }: { booking: DisplayBooking }) {
  const { row } = booking

  return (
    <TintedCard as="li" className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <p className="font-editorial text-xl leading-none text-foreground">
            {formatStudioTime(row.start_time, ADMIN_LOCALE)}–
            {formatStudioTime(row.end_time, ADMIN_LOCALE)}
          </p>
          <p className="font-functional text-sm text-foreground">
            {booking.serviceName ?? "Session"}
          </p>
          {booking.addonNames.length ? (
            <ul className="list-disc space-y-0.5 pl-4 font-functional text-xs text-muted-foreground">
              {booking.addonNames.map((name, index) => (
                // Static per-render list; index key avoids collisions if two
                // add-ons resolve to the same display name.
                <li key={index}>{name}</li>
              ))}
            </ul>
          ) : null}
          {row.status === BOOKING_STATUS.rescheduled ? (
            <Badge variant="warning" size="xs">
              Rescheduled
            </Badge>
          ) : null}
          {booking.clientNotes ? (
            <div className="pt-1">
              <p className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground">
                Note
              </p>
              <p className="whitespace-pre-line font-functional text-sm text-foreground">
                {booking.clientNotes}
              </p>
            </div>
          ) : null}
        </div>

        <div className="shrink-0 space-y-1 text-right">
          <PriceTag cents={row.total_price_cents} className="text-base" />
          {booking.durationMins ? (
            <p className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground">
              {booking.durationMins} min
            </p>
          ) : null}
        </div>
      </div>
    </TintedCard>
  )
}
