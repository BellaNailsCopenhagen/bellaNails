import Image from "next/image"
import { getTranslations } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { Container } from "@/components/layout/container"
import { Eyebrow, Caption } from "@/components/ui/typography"
import { footerNav, routes } from "@/config/routes"
import {
  STUDIO_ADDRESS_LINE_1,
  STUDIO_ADDRESS_LINE_2,
  STUDIO_EMAIL,
} from "@/config/studio"

/**
 * SiteFooter — a Studio block (brand, address, areas served + the Reserve
 * action) beside the link categories, which form one group that wraps together
 * so a wrap never tucks a category under the studio info; plus a copyright band.
 * The year is derived server-side. Columns come from the shared route registry
 * (`footerNav`); the Reserve link is lifted out of it and shown under Studio.
 */
export async function SiteFooter() {
  const t = await getTranslations("footer")
  const tNav = await getTranslations("nav")
  const year = new Date().getFullYear()
  // Reserve moves under the Studio block; the rest stay one wrapping group.
  const navColumns = footerNav.filter((col) => col.headingKey !== "session")

  return (
    <footer className="mt-auto border-t border-background/10 bg-primary text-primary-foreground">
      <Container className="flex flex-col gap-12 py-18 lg:flex-row lg:justify-between lg:gap-16">
        {/* Studio: brand, address, areas served, and the Reserve action. */}
        <div className="text-left">
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
            {STUDIO_ADDRESS_LINE_1}
            <br />
            {STUDIO_ADDRESS_LINE_2}
            <br />
            <a
              href={`mailto:${STUDIO_EMAIL}`}
              className="underline underline-offset-2 hover:text-primary-foreground"
            >
              {STUDIO_EMAIL}
            </a>
          </address>
          <Caption
            as="ul"
            className="ml-2 flex max-w-[18rem] flex-wrap gap-x-1.5 leading-relaxed text-[0.65rem] text-primary-foreground/55"
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

        {/* Link categories: one group that wraps together (2-up on mobile, a row
            on desktop), so a wrap never tucks a category under the studio info. */}
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 sm:gap-10 lg:gap-14">
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
