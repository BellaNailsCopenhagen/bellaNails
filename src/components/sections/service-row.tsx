import { Link } from "@/i18n/navigation"
import { HoverArrow } from "@/components/ui/arrow-link"
import { PriceTag } from "@/components/ui/price-tag"
import { Separator } from "@/components/ui/separator"
import { BodySm, Caption } from "@/components/ui/typography"
import type { MenuService } from "@/lib/services/get-service-menu"
import { pickLocalized } from "@/shared/localized"
import { routes, serviceDetailPath } from "@/config/routes"

/**
 * ServiceRow — the shared bookable service line (name + duration left, price +
 * hover CTA right) used by the services menu and the booking picker. The whole
 * row books via a "stretched" overlay link; in the menu a quiet "learn more"
 * link sits under the price ON TOP of that overlay, so tapping it opens the
 * detail page instead of booking — a distinct secondary action, not nested
 * inside the booking link. The booking picker omits it.
 */
export function ServiceRow({
  service,
  locale,
  minutesLabel,
  ctaLabel,
  learnMoreLabel,
}: {
  service: MenuService
  locale: string
  minutesLabel: string
  ctaLabel: string
  /** When set, render a "learn more" link to the detail page (menu only). */
  learnMoreLabel?: string
}) {
  const name =
    pickLocalized(locale, service.name_en, service.name_dk) ?? service.name_en

  return (
    <li>
      <div className="group relative -mx-4 flex items-start justify-between gap-6 rounded-sm px-4 py-5 transition-colors hover:bg-muted/60">
        {/* Stretched link: the whole row books. It sits behind the learn-more
            link (which is z-10), so that stays its own target. */}
        <Link
          href={{ pathname: routes.book, query: { service: service.id } }}
          aria-label={`${name} — ${ctaLabel}`}
          className="absolute inset-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <div className="space-y-1">
          <BodySm className="text-foreground">{name}</BodySm>
          <Caption className="block text-[11px] tracking-wide">
            {service.base_duration_mins} {minutesLabel}
          </Caption>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-baseline gap-5">
            <PriceTag cents={service.base_price_cents} className="text-lg" />
            {/* Always visible on touch; revealed on hover/focus on desktop. */}
            <Caption className="inline-flex items-center gap-1.5 text-foreground transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
              {ctaLabel}
              <HoverArrow />
            </Caption>
          </div>
          {learnMoreLabel ? (
            <Link
              href={serviceDetailPath(service.id)}
              className="relative z-10 font-functional text-[11px] lowercase text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
            >
              {learnMoreLabel}
            </Link>
          ) : null}
        </div>
      </div>
      <Separator />
    </li>
  )
}
