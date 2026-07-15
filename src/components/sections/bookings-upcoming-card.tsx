import { useLocale, useTranslations } from "next-intl"

import { Link } from "@/i18n/navigation"
import { CancelBookingButton } from "@/components/sections/cancel-booking-button"
import { Button } from "@/components/ui/button"
import { PriceTag } from "@/components/ui/price-tag"
import { Separator } from "@/components/ui/separator"
import { TintedCard } from "@/components/ui/tinted-card"
import { BodySm, Caption, H3 } from "@/components/ui/typography"
import { POLICY_WINDOW_MS, type DisplayBooking } from "@/lib/booking-display"
import {
  formatCountdown,
  formatStudioDate,
  formatStudioTime,
} from "@/lib/studio-time"
import { routes } from "@/config/routes"

/** Disabled inside the policy window; otherwise an in-app link (external
    Cal fallback for legacy rows without a cal_uid). */
const manageLinkProps = (
  withinPolicy: boolean,
  inAppHref: string | null,
  fallbackHref: string,
) =>
  withinPolicy
    ? { disabled: true }
    : {
        nativeButton: false as const,
        render: inAppHref ? (
          <Link href={inAppHref} />
        ) : (
          <a href={fallbackHref} target="_blank" rel="noreferrer" />
        ),
      }

/**
 * BookingsUpcomingCard — one upcoming appointment: date/time, countdown,
 * service + add-ons, stored total, reschedule/cancel via the row's Cal URLs.
 */
function BookingsUpcomingCard({
  booking,
  now,
}: {
  booking: DisplayBooking
  now: number
}) {
  const t = useTranslations("bookings")
  const tCatalog = useTranslations("services")
  const locale = useLocale()
  const { row } = booking

  const withinPolicy =
    new Date(row.start_time).getTime() - now < POLICY_WINDOW_MS

  return (
    <TintedCard as="li">
      <div className="space-y-6">
        {/* No status badge: everything upcoming is active ("rescheduled" is
            studio-side info). The corner counts down instead. */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <BodySm className="font-editorial text-2xl text-foreground">
              {formatStudioDate(row.start_time, locale)}
            </BodySm>
            <Caption className="block text-xs tracking-wide normal-case">
              {formatStudioTime(row.start_time, locale)}–
              {formatStudioTime(row.end_time, locale)}
            </Caption>
          </div>
          <Caption className="text-[10px] tracking-widest-lux">
            {formatCountdown(row.start_time, locale, now)}
          </Caption>
        </div>

        <Separator />

        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div className="space-y-2">
            <H3>{booking.serviceName ?? t("sessionFallback")}</H3>
            {booking.addonNames.length ? (
              <div className="space-y-1">
                <Caption className="block text-[10px] tracking-widest-lux">
                  {t("addonsLabel")}
                </Caption>
                <ul className="space-y-0.5 pl-4">
                  {booking.addonNames.map((name) => (
                    <BodySm as="li" key={name} className="list-disc">
                      {name}
                    </BodySm>
                  ))}
                </ul>
              </div>
            ) : null}
            {booking.durationMins ? (
              <Caption className="block text-[11px] tracking-wide">
                {booking.durationMins} {tCatalog("minutes")}
              </Caption>
            ) : null}
            {booking.clientNotes ? (
              <div className="space-y-1 pt-1">
                <Caption className="block text-[10px] tracking-widest-lux">
                  {t("notesLabel")}
                </Caption>
                <BodySm className="max-w-md whitespace-pre-line">
                  {booking.clientNotes}
                </BodySm>
              </div>
            ) : null}
          </div>
          <PriceTag cents={row.total_price_cents} className="text-lg" />
        </div>

        {/* Inside the 24 h window the actions render disabled with the
            reason — failing at Cal's page would be a worse surprise. */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              {...manageLinkProps(
                withinPolicy,
                row.cal_uid ? `${routes.bookings}/reschedule/${row.cal_uid}` : null,
                row.reschedule_url,
              )}
            >
              {t("reschedule")}
            </Button>
            {row.cal_uid ? (
              <CancelBookingButton uid={row.cal_uid} disabled={withinPolicy} />
            ) : (
              <Button
                variant="destructive"
                size="sm"
                {...manageLinkProps(withinPolicy, null, row.cancel_url)}
              >
                {t("cancel")}
              </Button>
            )}
          </div>
          {withinPolicy ? (
            <Caption className="block text-[11px] leading-relaxed tracking-wide normal-case">
              {t("within24h")}
            </Caption>
          ) : null}
        </div>
      </div>
    </TintedCard>
  )
}

export { BookingsUpcomingCard }
