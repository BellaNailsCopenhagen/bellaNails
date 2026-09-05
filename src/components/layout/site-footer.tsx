import Image from "next/image"
import { getLocale, getTranslations } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { OpeningHours } from "@/app/[locale]/_components/opening-hours"
import { Container } from "@/components/layout/container"
import { Eyebrow, Caption } from "@/components/ui/typography"
import { footerNavFor, routes } from "@/config/routes"
import { getBusinessProfile } from "@/modules/business/profile"
import { getSchedule } from "@/modules/studio/hours"
import { hasOpeningHours } from "@/shared/opening-hours"

/**
 * SiteFooter — a Studio block (brand, address, areas served + the Reserve
 * action) beside the link categories, which form one group that wraps together
 * so a wrap never tucks a category under the studio info; plus a copyright band.
 * The year is derived server-side. Columns come from the shared route registry
 * (`footerNavFor`, which takes the studio's own social + contact details); the
 * Reserve link is lifted out of it and shown under Studio.
 */
export async function SiteFooter() {
  const [t, tNav, tHours, locale, profile, schedule] = await Promise.all([
    getTranslations("footer"),
    getTranslations("nav"),
    getTranslations("hours"),
    getLocale(),
    getBusinessProfile(),
    getSchedule(),
  ])
  const year = new Date().getFullYear()
  // Reserve moves under the Studio block; the rest stay one wrapping group.
  const navColumns = footerNavFor(profile).filter(
    (col) => col.headingKey !== "session",
  )

  return (
    <footer className="mt-auto border-t border-background/10 bg-primary text-primary-foreground">
      {/* Two equal halves from `md`, one column below it. `flex-1` on both
          rather than `justify-between`: the business side and the links side
          each take half, so neither is squeezed by however many link groups or
          social accounts exist. */}
      <Container className="flex flex-col gap-14 py-18 md:flex-row md:items-start md:gap-16">
        {/* Who and where, beside when. Two columns rather than one tall stack —
            the hours under the address pushed the areas served and the Reserve
            action below the fold, and left the middle of the footer empty. */}
        <div className="flex flex-1 flex-col gap-10 text-left md:flex-row md:gap-12">
          <div className="min-w-0">
            <Link
              href={routes.home}
              className="block w-fit"
              aria-label="Bella Nails home"
            >
              <Image
                src="/brand/bella-nails-horizontal-reverse.svg"
                alt="Bella Nails"
                width={224}
                height={32}
                className="h-auto w-[10rem] sm:w-[11.25rem]"
              />
            </Link>
            <address className="font-functional ml-2 text-sm leading-8 not-italic text-primary-foreground/72">
              {profile.addressLine1 ? (
                <>
                  {profile.addressLine1}
                  <br />
                </>
              ) : null}
              {profile.addressLine2 ? (
                <>
                  {profile.addressLine2}
                  <br />
                </>
              ) : null}
              <a
                href={`mailto:${profile.contactEmail}`}
                className="underline underline-offset-2 hover:text-primary-foreground"
              >
                {profile.contactEmail}
              </a>
            </address>
            <Caption
              as="ul"
              className="ml-2 mt-6 flex max-w-[18rem] flex-wrap gap-x-1.5 leading-relaxed text-[0.65rem] text-primary-foreground/55"
            >
              {(t.raw("areasServed") as string[]).map((area, index) => (
                <li key={area} className="whitespace-nowrap">
                  {index > 0 && (
                    <span
                      aria-hidden
                      className="mr-1.5 text-primary-foreground/35"
                    >
                      ·
                    </span>
                  )}
                  {area}
                </li>
              ))}
            </Caption>
            <Link
              href={routes.book}
              className="mt-6 ml-2 inline-block font-functional text-[12px] font-medium uppercase tracking-[0.06em] text-primary-foreground underline underline-offset-4 transition-colors hover:text-primary-foreground/80"
            >
              {tNav("reserve")}
            </Link>
          </div>

          {/* When. Its own column, aligned with the wordmark rather than
              indented under the address. */}
          {hasOpeningHours(schedule) ? (
            <div className="shrink-0 space-y-3">
              <Eyebrow className="text-[0.65rem] text-primary-foreground/65">
                {t("hours")}
              </Eyebrow>
              <OpeningHours
                schedule={schedule}
                locale={locale}
                closedLabel={tHours("closed")}
                className="font-functional text-[12px] leading-6 text-primary-foreground/82"
              />
            </div>
          ) : null}
        </div>

        {/* One column on a phone — a 2-up grid of two-word links wasted the
            row and read as a table. A wrapping flex row from `md`, not a fixed
            4-column grid: the Follow column is dropped entirely when she has
            given us no social accounts. */}
        <div className="flex flex-1 flex-col gap-8 md:flex-row md:flex-wrap md:gap-10 lg:gap-14">
          {navColumns.map((col) => (
            <div key={col.headingKey} className="space-y-4">
              <Eyebrow className="text-[0.65rem] text-primary-foreground/65">
                {t(col.headingKey)}
              </Eyebrow>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    {link.external ? (
                      <a
                        href={link.href}
                        // mailto opens the mail client, not a new browser tab.
                        {...(link.href.startsWith("mailto:")
                          ? {}
                          : { target: "_blank", rel: "noreferrer" })}
                        className="cursor-pointer font-functional text-[12px] font-medium tracking-[0.02em] text-primary-foreground/82 transition-colors hover:text-primary-foreground"
                      >
                        {t(link.labelKey)}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="cursor-pointer font-functional text-[12px] font-medium tracking-[0.02em] text-primary-foreground/82 transition-colors hover:text-primary-foreground"
                      >
                        {tNav(link.labelKey)}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Container>

      <div className="border-t border-primary-foreground/12">
        <Container className="py-6">
          <Caption className="text-[0.65rem] text-primary-foreground/65">
            © {year} Bella Nails. {t("rights")}
          </Caption>
        </Container>
      </div>
    </footer>
  )
}
