import type * as React from "react"
import Link from "next/link"
import { Mail, Phone, TriangleAlert, User } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PriceTag } from "@/components/ui/price-tag"
import { TintedCard } from "@/components/ui/tinted-card"
import { AddBookingMediaButton } from "@/components/admin/add-booking-media-button"
import { AdminCancelButton } from "@/components/admin/admin-cancel-button"
import { AdminNoShowButton } from "@/components/admin/admin-no-show-button"
import { cardActionNeutral } from "@/components/admin/card-action"
import { NO_SHOW_ALERT_THRESHOLD } from "@/lib/booking-reputation"
import { BOOKING_STATUS } from "@/lib/booking-status"
import type { DisplayBooking } from "@/lib/booking-display"
import { contactDisplayName, type ClientContact } from "@/lib/clerk/contact"
import { formatStudioTime } from "@/lib/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"

// Keep only digits and a leading "+", so odd separators (dots, spaces, 00…)
// can't produce an unparseable tel: URI.
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`

/**
 * A booking card — the queue's list item and the Bookings view's expanded
 * detail. English-only (the admin has no next-intl context), reusing the shared
 * display shapes. Client name + contact come from Clerk (resolved in the RSC,
 * never persisted). `actionable` gates reschedule/cancel — off for past or
 * cancelled bookings; `noShowEligible` reveals the studio-side no-show toggle
 * (an hour past start); `as` lets it render outside a <ul> (Bookings view).
 */
// The artist can add media from 30 min before the appointment onward (and any
// time after — result photos are shot during/after).
const ADD_MEDIA_LEAD_MS = 30 * 60 * 1000

export function QueueBookingCard({
  booking,
  contact,
  clientNoShowCount = 0,
  actionable = true,
  noShowEligible = false,
  now,
  photos = [],
  as = "li",
}: {
  booking: DisplayBooking
  contact?: ClientContact
  /** Client's total no-shows across all bookings — flags repeat offenders. */
  clientNoShowCount?: number
  actionable?: boolean
  noShowEligible?: boolean
  /** Request-time clock. When given, reveals "Add media" ≥30min before start. */
  now?: number
  /** Attached media thumbnails — tap to open the gallery at that image. */
  photos?: { id: string; url: string; kind: string }[]
  as?: React.ElementType
}) {
  const { row } = booking
  const clientName = contactDisplayName(contact)
  const isRepeatNoShow = clientNoShowCount >= NO_SHOW_ALERT_THRESHOLD
  // The pseudonymous Clerk id is the client's stable key — links to their
  // profile + booking history. Route is /admin/clients/[id] (built separately).
  const clientHref = row.clerk_user_id
    ? `/admin/clients/${row.clerk_user_id}`
    : null
  const hasUid = Boolean(row.cal_uid)
  const isNoShow = Boolean(row.no_show_at)
  const canToggleNoShow = hasUid && noShowEligible
  // Future-only, and gone once the booking is a no-show.
  const canReschedule = hasUid && actionable && !isNoShow
  const canCancel = hasUid && actionable && !isNoShow
  const hasActions = canReschedule || canCancel || canToggleNoShow
  const canAddMedia =
    now != null &&
    Boolean(row.clerk_user_id) &&
    now >= new Date(row.start_time).getTime() - ADD_MEDIA_LEAD_MS

  return (
    <TintedCard as={as} className="space-y-3 p-4 sm:p-5">
      {/* Contact + client actions — first thing on the card, reaching the
          client or opening their profile/history. */}
      {contact?.phone || contact?.email || clientHref || canAddMedia ? (
        <div className="flex flex-wrap items-center gap-4">
          {contact?.phone ? (
            <a
              href={telHref(contact.phone)}
              className={cardActionNeutral("gap-1 text-[0.625rem]")}
            >
              <Phone className="size-3" />
              Call
            </a>
          ) : null}
          {contact?.email ? (
            <a
              href={`mailto:${contact.email}`}
              className={cardActionNeutral("gap-1 text-[0.625rem]")}
            >
              <Mail className="size-3" />
              Email
            </a>
          ) : null}
          {canAddMedia && row.clerk_user_id ? (
            <AddBookingMediaButton
              bookingId={row.id}
              clerkUserId={row.clerk_user_id}
            />
          ) : null}
          {clientHref ? (
            <Link
              href={clientHref}
              className={cardActionNeutral("ml-auto gap-1 text-[0.625rem]")}
            >
              <User className="size-3" />
              View client
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <p className="font-editorial text-xl leading-none text-foreground">
            {formatStudioTime(row.start_time, ADMIN_LOCALE)}–
            {formatStudioTime(row.end_time, ADMIN_LOCALE)}
          </p>
          {clientHref ? (
            <Link
              href={clientHref}
              className="block font-functional text-sm font-medium text-foreground hover:underline"
            >
              {clientName}
            </Link>
          ) : (
            <p className="font-functional text-sm font-medium text-foreground">
              {clientName}
            </p>
          )}
          {/* Client-level reputation — distinct from this booking's own
              No-show badge below. */}
          {isRepeatNoShow ? (
            <Badge variant="destructive" size="xs" className="gap-1">
              <TriangleAlert className="size-3" />
              {clientNoShowCount} no-shows
            </Badge>
          ) : null}
          {/* Contact details in plain text — the artist sees who this is at a
              glance; the Call/Email actions above are the tap targets. */}
          {contact?.phone || contact?.email ? (
            <div className="font-functional text-xs text-muted-foreground">
              {contact?.phone ? <p>{contact.phone}</p> : null}
              {contact?.email ? (
                <p className="truncate">{contact.email}</p>
              ) : null}
            </div>
          ) : null}
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
          {row.no_show_at ? (
            <Badge variant="destructive" size="xs">
              No-show
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

      {/* Attached media — tap a thumbnail to open it in the Assets hub. */}
      {photos.length ? (
        <div className="flex flex-wrap gap-1.5">
          {photos.slice(0, 6).map((photo) => (
            <Link
              key={photo.id}
              href={`/admin/assets?highlight=${photo.id}`}
              aria-label="Open in assets"
              className="block shrink-0"
            >
              {photo.kind === "video" ? (
                <span className="flex size-12 items-center justify-center rounded-sm border border-border bg-muted font-functional text-xs text-muted-foreground">
                  ▶
                </span>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={photo.url}
                  alt=""
                  className="size-12 rounded-sm border border-border object-cover"
                />
              )}
            </Link>
          ))}
        </div>
      ) : null}

      {/* Card actions — the destructive one (Cancel or No-show, never both) sits
          left; Reschedule/Rebook is the primary action, kept right. Contact
          actions live at the top of the card, by the client's name. */}
      {hasActions ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {canCancel ? (
              <AdminCancelButton uid={row.cal_uid!} clientName={clientName} />
            ) : null}
            {canToggleNoShow ? (
              <AdminNoShowButton uid={row.cal_uid!} marked={isNoShow} />
            ) : null}
          </div>
          {canReschedule ? (
            /* In-app reschedule-on-behalf — same Cal embed as the client. */
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`/admin/reschedule/${row.cal_uid}`} />}
            >
              Reschedule
            </Button>
          ) : null}
        </div>
      ) : null}
    </TintedCard>
  )
}
