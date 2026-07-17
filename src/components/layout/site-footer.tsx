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
 * SiteFooter — logo column, address column, three nav columns, and a separate
 * copyright band. The year is derived server-side so it stays current without
 * manual maintenance. Nav columns come from the shared route registry
 * (`footerNav`); labels are resolved here so the footer can localize them.
 */
export async function SiteFooter() {
  const t = await getTranslations("footer")
  const tNav = await getTranslations("nav")
  const year = new Date().getFullYear()

  return (
    <footer className="mt-auto border-t border-background/10 bg-primary text-primary-foreground">
      <Container className="grid gap-10 py-18 xs:grid-cols-2 sm:gap-6 sm:grid-cols-[1.5fr_repeat(3,minmax(0,1fr))]">
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
        </div>

        {footerNav.map((col) => (
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
                      target="_blank"
                      rel="noreferrer"
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
