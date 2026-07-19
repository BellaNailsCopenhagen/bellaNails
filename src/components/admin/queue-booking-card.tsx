import { Mail, Phone } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { PriceTag } from "@/components/ui/price-tag"
import { TintedCard } from "@/components/ui/tinted-card"
import { BOOKING_STATUS } from "@/lib/booking-status"
import type { DisplayBooking } from "@/lib/booking-display"
import type { ClientContact } from "@/lib/clerk/client-contacts"
import { formatStudioTime } from "@/lib/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"

const telHref = (phone: string) => `tel:${phone.replace(/[\s()-]/g, "")}`

/**
 * A booking in the admin queue — condensed vs the client's card. English-only
 * (the admin has no next-intl context), reusing the shared display shapes.
 *
 * Client name + contact come from Clerk (resolved in the RSC, never persisted).
 * The name is a distinct element so Task 07 can wrap it in a link to the client
 * page without reworking the card. Cancel lands in a later increment.
 */
export function QueueBookingCard({
  booking,
  contact,
}: {
  booking: DisplayBooking
  contact?: ClientContact
}) {
  const { row } = booking
  const clientName = contact?.firstName || contact?.fullName || "Client"

  return (
    <TintedCard as="li" className="space-y-3 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <p className="font-editorial text-xl leading-none text-foreground">
            {formatStudioTime(row.start_time, ADMIN_LOCALE)}–
            {formatStudioTime(row.end_time, ADMIN_LOCALE)}
          </p>
          {/* Distinct element — Task 07 wraps this in a link to /admin/clients. */}
          <p className="font-functional text-sm font-medium text-foreground">
            {clientName}
          </p>
          <p className="font-functional text-sm text-muted-foreground">
            {booking.serviceName ?? "Session"}
          </p>
          {booking.addonNames.length ? (
            <ul className="list-disc space-y-0.5 pl-4 font-functional text-xs text-muted-foreground">
              {booking.addonNames.map((name, index) => (
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

      {contact?.phone || contact?.email ? (
        <div className="flex flex-wrap gap-5 border-t border-border pt-3">
          {contact.phone ? (
            <a
              href={telHref(contact.phone)}
              className="flex items-center gap-1.5 font-functional text-xs uppercase tracking-widest-lux text-foreground/70 transition-colors hover:text-foreground"
            >
              <Phone className="size-3.5" />
              Call
            </a>
          ) : null}
          {contact.email ? (
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center gap-1.5 font-functional text-xs uppercase tracking-widest-lux text-foreground/70 transition-colors hover:text-foreground"
            >
              <Mail className="size-3.5" />
              Email
            </a>
          ) : null}
        </div>
      ) : null}
    </TintedCard>
  )
}
