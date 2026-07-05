import { getLocale, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Container, Section } from "@/components/layout/container";
import { ArrowLink } from "@/components/ui/arrow-link";
import { Button } from "@/components/ui/button";
import { PriceTag } from "@/components/ui/price-tag";
import { SectionHeading } from "@/components/ui/section-heading";
import { BodySm, Caption, H3 } from "@/components/ui/typography";
import { getFeaturedServices } from "@/lib/services/get-featured-services";
import { pickLocalized } from "@/lib/i18n/localized";

/**
 * ServicesPreview — "A Selection of the Studio's Best". Reads the featured
 * services from Supabase (public anon read via RLS), localized by the active
 * locale, prices via PriceTag. Renders nothing if there are no featured rows.
 */
export async function ServicesPreview() {
  const [t, tNav, locale] = await Promise.all([
    getTranslations("services"),
    getTranslations("nav"),
    getLocale(),
  ]);

  const services = await getFeaturedServices();

  if (!services.length) return null;

  return (
    <Section>
      <Container className="max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow={t("eyebrow")}
            lead={t("headingLead")}
            accent={t("headingAccent")}
            accentTone="secondary"
          />
          <ArrowLink href="/services">{t("viewFullMenu")}</ArrowLink>
        </div>

        <ul className="mt-6 border-b border-border">
          {services.map((service, i) => {
            const name =
              pickLocalized(locale, service.name_en, service.name_dk) ??
              service.name_en;
            const description =
              pickLocalized(
                locale,
                service.description_en,
                service.description_dk,
              ) ?? "";
            return (
              <li
                key={service.id}
                className="grid grid-cols-1 gap-x-8 gap-y-3 border-t border-border py-6 md:grid-cols-[2.5rem_minmax(11rem,1fr)_1.4fr_auto] md:items-start"
              >
                <Caption className="text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </Caption>
                <div className="space-y-1">
                  <H3>{name}</H3>
                  <Caption className="tracking-wide text-muted-foreground">
                    {service.base_duration_mins} {t("minutes")}
                  </Caption>
                </div>
                <BodySm className="max-w-sm">{description}</BodySm>
                <PriceTag cents={service.base_price_cents} className="text-lg" />
              </li>
            );
          })}
        </ul>

        <Button
          className="mt-6"
          nativeButton={false}
          render={<Link href="/book" />}
        >
          {tNav("reserve")}
        </Button>
      </Container>
    </Section>
  );
}
