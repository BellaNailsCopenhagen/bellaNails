import { useLocale, useTranslations } from "next-intl"

import { ArrowLink } from "@/components/ui/arrow-link"
import { BookingStatusBadge } from "@/app/[locale]/appointments/_components/booking-status-badge"
import { BookingPhotos } from "@/app/[locale]/appointments/_components/booking-photos"
import { PriceTag } from "@/components/ui/price-tag"
import { BodySm, Caption } from "@/components/ui/typography"
import { BOOKING_STATUS } from "@/shared/booking-status"
import { type DisplayBooking } from "@/shared/booking-view"
import { metaOf } from "@/shared/booking-policy"
import type { ClientMediaItem } from "@/modules/media/client-gallery"
import { formatStudioDate } from "@/shared/studio-time"
import { routes } from "@/config/routes"

/**
 * BookingsPastRow — condensed history line: service, date (+ cancelled
 * badge), stored total, and a "book again" deep link into the booking flow
 * with the service preselected.
 */
function BookingsPastRow({
  booking,
  photos,
}: {
  booking: DisplayBooking
  photos: ClientMediaItem[]
}) {
  const t = useTranslations("bookings")
  const locale = useLocale()
  const { row } = booking
  const meta = metaOf(row)
  // Rebook the whole treatment (add-ons preselect on the customise step) —
  // only while the service still exists in the catalog.
  const rebookQuery =
    booking.rebookable && meta.serviceId
      ? {
          service: meta.serviceId,
          ...(meta.addonIds?.length ? { addons: meta.addonIds.join(",") } : {}),
        }
      : null

  return (
    <li className="border-b border-border first:border-t">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 py-5">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2.5">
            <BodySm className="text-base text-foreground">
              {booking.serviceName ?? t("sessionFallback")}
            </BodySm>
            {/* Every history row states its outcome: cancelled as stored,
                anything else reads as completed (derived, never stored). */}
            <BookingStatusBadge
              status={
                row.status === BOOKING_STATUS.cancelled
                  ? row.status
                  : "completed"
              }
            />
          </div>
          <Caption className="block text-[11px] tracking-wide normal-case">
            {formatStudioDate(row.start_time, locale)}
          </Caption>
        </div>
        <div className="flex items-baseline gap-5">
          <PriceTag
            cents={row.total_price_cents}
            className="text-sm text-muted-foreground"
          />
          {rebookQuery ? (
            <ArrowLink href={{ pathname: routes.book, query: rebookQuery }}>
              {t("bookAgain")}
            </ArrowLink>
          ) : null}
        </div>
      </div>

      {/* Client adds photos of the finished set (shared with the artist). Only
          for real (non-cancelled) appointments. */}
      {row.status !== BOOKING_STATUS.cancelled ? (
        <div className="pb-5">
          <BookingPhotos bookingId={row.id} photos={photos} />
        </div>
      ) : null}
    </li>
  )
}

export { BookingsPastRow }
