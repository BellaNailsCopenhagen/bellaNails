import { Fragment } from "react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Container, Section } from "@/components/layout/container";
import { HoverArrow } from "@/components/ui/arrow-link";
import { PriceTag } from "@/components/ui/price-tag";
import { Separator } from "@/components/ui/separator";
import {
  BodySm,
  Caption,
  Display,
  Eyebrow,
  H2,
  HeadingLine,
  HeadingMuted,
} from "@/components/ui/typography";
import { getServiceMenu, type MenuCategory } from "@/lib/services/get-service-menu";
import { pickLocalized } from "@/lib/i18n/localized";
import { routes } from "@/config/routes";

async function CategorySection({
  category,
  index,
  locale,
}: {
  category: MenuCategory;
  index: number;
  locale: string;
}) {
  // Per-request translation lookups are cached by next-intl, so fetching
  // here (rather than prop-drilling labels) costs nothing.
  const [t, tCatalog] = await Promise.all([
    getTranslations("serviceMenu"),
    getTranslations("services"),
  ]);
  const name =
    pickLocalized(locale, category.name_en, category.name_dk) ??
    category.name_en;
  const description =
    pickLocalized(locale, category.description_en, category.description_dk) ??
    "";

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

          {/* Each row is the booking entry point (/book reads `?service=`
              to preselect, Phase 6) with a card-like hover fill. */}
          <ul>
            {category.services.map((service) => {
              const serviceName =
                pickLocalized(locale, service.name_en, service.name_dk) ??
                service.name_en;
              return (
                <li key={service.id}>
                  <Link
                    href={{
                      pathname: routes.book,
                      query: { service: service.id },
                    }}
                    className="group -mx-4 flex items-center justify-between gap-6 rounded-sm px-4 py-5 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <div className="space-y-1">
                      <BodySm className="text-foreground">{serviceName}</BodySm>
                      <Caption className="block text-[11px] tracking-wide">
                        {service.base_duration_mins} {tCatalog("minutes")}
                      </Caption>
                    </div>
                    <div className="flex items-baseline gap-5">
                      <PriceTag
                        cents={service.base_price_cents}
                        className="text-lg"
                      />
                      {/* Always visible on touch; revealed on hover/focus on
                          desktop (opacity keeps the price from shifting). */}
                      <Caption className="inline-flex items-center gap-1.5 text-foreground transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-visible:opacity-100">
                        {t("rowCta")}
                        <HoverArrow />
                      </Caption>
                    </div>
                  </Link>
                  <Separator />
                </li>
              );
            })}
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
  );
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
  ]);

  return (
    <Section>
      <Container className="max-w-4xl">
        {/* Heading left, intro note right — stacks below md. */}
        <div className="grid gap-x-16 gap-y-8 pb-16 md:grid-cols-[1fr_19rem] md:items-end">
          <div className="space-y-6">
            <Eyebrow>{t("eyebrow")}</Eyebrow>
            <Display>
              <HeadingLine>{t("headingLead")}</HeadingLine>
              <HeadingMuted>{t("headingMuted")}</HeadingMuted>
            </Display>
          </div>
          <BodySm>{t("intro")}</BodySm>
        </div>

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
  );
}
