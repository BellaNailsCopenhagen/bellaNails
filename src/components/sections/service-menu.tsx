import { Fragment } from "react"
import Image from "next/image"
import { getLocale, getTranslations } from "next-intl/server"

import { Container, Section } from "@/components/layout/container"
import { ServiceRow } from "@/components/sections/service-row"
import { PageHeader } from "@/components/ui/page-header"
import { Separator } from "@/components/ui/separator"
import { BodySm, Caption, Eyebrow, H2 } from "@/components/ui/typography"
import {
  getServiceMenu,
  type MenuCategory,
} from "@/lib/services/get-service-menu"
import { pickLocalized } from "@/lib/i18n/localized"

async function CategorySection({
  category,
  index,
  locale,
}: {
  category: MenuCategory
  index: number
  locale: string
}) {
  // Per-request translation lookups are cached by next-intl, so fetching
  // here (rather than prop-drilling labels) costs nothing.
  const [t, tCatalog] = await Promise.all([
    getTranslations("serviceMenu"),
    getTranslations("services"),
  ])
  const name =
    pickLocalized(locale, category.name_en, category.name_dk) ??
    category.name_en
  const description =
    pickLocalized(locale, category.description_en, category.description_dk) ??
    ""

  return (
    <section className="py-16 sm:py-20">
      <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between md:gap-16">
        <div className="w-full max-w-md space-y-10">
          <div className="space-y-8">
            <div className="flex items-end gap-4">
              <Caption className="pb-1">
                {String(index + 1).padStart(2, "0")}
              </Caption>
              <H2>{name}</H2>
            </div>
            {description ? <BodySm>{description}</BodySm> : null}
          </div>

          <ul>
            {category.services.map((service) => (
              <ServiceRow
                key={service.id}
                service={service}
                locale={locale}
                minutesLabel={tCatalog("minutes")}
                ctaLabel={t("rowCta")}
              />
            ))}
          </ul>
        </div>

        {category.image_url ? (
          <div className="relative aspect-[3/4] w-full max-w-[300px] shrink-0 overflow-hidden bg-muted">
            <Image
              src={category.image_url}
              alt={t("imageAlt", { category: name })}
              fill
              sizes="(min-width: 768px) 300px, 100vw"
              className="object-cover object-center"
            />
          </div>
        ) : null}
      </div>
    </section>
  )
}

/**
 * ServiceMenu — the full "The Menu — Treatments & Care" page body. One
 * numbered section per active category from Supabase (localized, PriceTag),
 * closed by the studio's note on pricing and the main reserve CTA.
 */
export async function ServiceMenu() {
  const [t, locale, categories] = await Promise.all([
    getTranslations("serviceMenu"),
    getLocale(),
    getServiceMenu(),
  ])

  return (
    <Section>
      <Container className="max-w-4xl">
        <PageHeader
          eyebrow={t("eyebrow")}
          lead={t("headingLead")}
          muted={t("headingMuted")}
          intro={t("intro")}
        />

        <Separator />

        {categories.map((category, index) => (
          <Fragment key={category.id}>
            <CategorySection
              category={category}
              index={index}
              locale={locale}
            />
            <Separator />
          </Fragment>
        ))}

        <div className="space-y-4 pt-16 sm:pt-20">
          <Eyebrow>{t("pricingNoteLabel")}</Eyebrow>
          <div className="max-w-sm space-y-3">
            <BodySm className="text-xs">{t("pricingNoteBody")}</BodySm>
            <BodySm className="text-xs">{t("policyNote")}</BodySm>
          </div>
        </div>
      </Container>
    </Section>
  )
}
