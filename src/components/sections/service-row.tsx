import { Link } from "@/i18n/navigation"
import { HoverArrow } from "@/components/ui/arrow-link"
import { PriceTag } from "@/components/ui/price-tag"
import { Separator } from "@/components/ui/separator"
import { BodySm, Caption } from "@/components/ui/typography"
import type { MenuService } from "@/lib/services/get-service-menu"
import { pickLocalized } from "@/lib/i18n/localized"
import { routes } from "@/config/routes"

/**
 * ServiceRow — the shared bookable service line (name + duration left, price +
 * hover CTA right, hairline below) used by the services menu and the booking
 * picker. The whole row links to /book?service=<id>: the booking page reads
 * the param to open that service's add-on step (Phase 6).
 */
export function ServiceRow({
  service,
  locale,
  minutesLabel,
  ctaLabel,
}: {
  service: MenuService
  locale: string
  minutesLabel: string
  ctaLabel: string
}) {
  const name =
    pickLocalized(locale, service.name_en, service.name_dk) ?? service.name_en

  return (
    <li>
      <Link
        href={{ pathname: routes.book, query: { service: service.id } }}
        className="group -mx-4 flex items-center justify-between gap-6 rounded-sm px-4 py-5 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <div className="space-y-1">
          <BodySm className="text-foreground">{name}</BodySm>
          <Caption className="block text-[11px] tracking-wide">
            {service.base_duration_mins} {minutesLabel}
          </Caption>
        </div>
        <div className="flex items-baseline gap-5">
          <PriceTag cents={service.base_price_cents} className="text-lg" />
          {/* Always visible on touch; revealed on hover/focus on desktop
              (opacity keeps the price from shifting). */}
          <Caption className="inline-flex items-center gap-1.5 text-foreground transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-visible:opacity-100">
            {ctaLabel}
            <HoverArrow />
          </Caption>
        </div>
      </Link>
      <Separator />
    </li>
  )
}
