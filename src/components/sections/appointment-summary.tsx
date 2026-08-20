import { useTranslations } from "next-intl"

import { cn } from "@/shared/cn"
import { Link } from "@/i18n/navigation"
import { PriceTag } from "@/components/ui/price-tag"
import { Separator } from "@/components/ui/separator"
import { TintedCard } from "@/components/ui/tinted-card"
import { BodySm, Caption, Eyebrow, H3 } from "@/components/ui/typography"
import {
  computeBookingTotals,
  type BookingLineItem,
} from "@/lib/services/booking-totals"
import { routes } from "@/config/routes"

/**
 * AppointmentSummary — the tinted running-total card shared by the booking
 * steps: service, total duration, line items (base + selected add-ons),
 * editorial total, and the payment/cancellation fine print. Renders on the
 * server (details step) and inside the client customizer alike.
 */
function AppointmentSummary({
  service,
  selectedAddons,
  showTimeNote = true,
  className,
}: {
  service: BookingLineItem
  selectedAddons: BookingLineItem[]
  /** Hide the "you'll pick a time next" note on the step that IS the picker. */
  showTimeNote?: boolean
  /** Width/breakpoint overrides for layouts that stack differently. */
  className?: string
}) {
  const t = useTranslations("booking")
  const tCatalog = useTranslations("services")

  const { totalCents, totalMins } = computeBookingTotals(
    service,
    selectedAddons,
  )

  return (
    <TintedCard as="aside" className={cn("md:max-w-[22.5rem]", className)}>
      <div className="space-y-6">
        <Eyebrow className="font-normal">{t("summaryLabel")}</Eyebrow>

        <div className="space-y-1">
          <H3>{service.name}</H3>
          <Caption className="block tracking-wide normal-case">
            {t("privateSession")}
          </Caption>
        </div>

        <div className="flex items-baseline justify-between">
          <Caption className="text-[10px] tracking-widest">
            {t("durationLabel")}
          </Caption>
          <Caption className="text-[10px] tracking-widest text-foreground">
            {totalMins} {tCatalog("minutes")}
          </Caption>
        </div>
        {showTimeNote ? (
          <Caption className="block text-[11px] tracking-wide normal-case">
            {t("timeNote")}
          </Caption>
        ) : null}

        <Separator />

        <ul className="space-y-2">
          <li className="flex items-baseline justify-between gap-6">
            <BodySm className="text-foreground">{service.name}</BodySm>
            <PriceTag cents={service.priceCents} className="text-sm" />
          </li>
          {selectedAddons.map((addon) => (
            <li
              key={addon.id}
              className="flex items-baseline justify-between gap-6"
            >
              <BodySm>{addon.name}</BodySm>
              <PriceTag
                cents={addon.priceCents}
                sign
                className="text-sm text-muted-foreground"
              />
            </li>
          ))}
        </ul>

        <Separator />

        <div className="flex items-baseline justify-between gap-6">
          <Eyebrow as="span">{t("totalLabel")}</Eyebrow>
          <PriceTag cents={totalCents} className="font-editorial text-2xl" />
        </div>

        <Caption className="block text-[11px] leading-relaxed tracking-wide normal-case">
          {t("paymentNote")}{" "}
          <Link
            href={routes.terms}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 transition-colors hover:text-foreground"
          >
            {t("termsLink")}
          </Link>
        </Caption>
      </div>
    </TintedCard>
  )
}

export { AppointmentSummary }
