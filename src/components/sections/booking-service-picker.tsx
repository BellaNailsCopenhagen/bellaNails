import { Fragment } from "react";
import { getLocale, getTranslations } from "next-intl/server";

import { Container, Section } from "@/components/layout/container";
import { ServiceRow } from "@/components/sections/service-row";
import { PageHeader } from "@/components/ui/page-header";
import { Separator } from "@/components/ui/separator";
import { BodySm, Caption, Eyebrow, H2 } from "@/components/ui/typography";
import { getServiceMenu } from "@/lib/services/get-service-menu";
import { pickLocalized } from "@/lib/i18n/localized";

/**
 * BookingServicePicker — step 1 of the booking flow ("Customise Your
 * Session"): the full menu grouped by category, compact (no images or
 * category descriptions). Landing here without a `?service=` preselect,
 * the visitor picks a treatment; each row advances to that service's
 * add-on step. Shares ServiceRow and the catalog read with /services.
 */
export async function BookingServicePicker() {
  const [t, tMenu, tCatalog, locale, categories] = await Promise.all([
    getTranslations("booking"),
    getTranslations("serviceMenu"),
    getTranslations("services"),
    getLocale(),
    getServiceMenu(),
  ]);

  return (
    <Section>
      <Container className="max-w-4xl">
        <PageHeader
          eyebrow={t("eyebrow")}
          lead={t("headingLine1")}
          muted={t("headingLine2")}
          intro={t("intro")}
        />

        <Separator />

        {categories.map((category, index) => {
          const name =
            pickLocalized(locale, category.name_en, category.name_dk) ??
            category.name_en;
          return (
            <Fragment key={category.id}>
              <section className="py-16 sm:py-20">
                <div className="mx-auto w-full space-y-5 md:max-w-[25rem]">
                  <div className="flex items-end gap-4">
                    <Caption className="pb-1">
                      {String(index + 1).padStart(2, "0")}
                    </Caption>
                    <H2>{name}</H2>
                  </div>
                  <Separator />
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
              </section>
              <Separator />
            </Fragment>
          );
        })}

        <div className="space-y-4 pt-16 sm:pt-20">
          <Eyebrow>{tMenu("pricingNoteLabel")}</Eyebrow>
          <div className="max-w-sm space-y-3">
            <BodySm className="text-xs">{tMenu("pricingNoteBody")}</BodySm>
            <BodySm className="text-xs">{tMenu("policyNote")}</BodySm>
          </div>
        </div>
      </Container>
    </Section>
  );
}
