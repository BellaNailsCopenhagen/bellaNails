import { getLocale, getTranslations } from "next-intl/server";

import { Container, Section } from "@/components/layout/container";
import { BookingCustomizer } from "@/components/sections/booking-customizer";
import { BookingSteps } from "@/components/sections/booking-steps";
import { ArrowLink } from "@/components/ui/arrow-link";
import { PageHeader } from "@/components/ui/page-header";
import { Separator } from "@/components/ui/separator";
import type { ServiceWithAddons } from "@/lib/services/get-service-with-addons";
import { pickLocalized } from "@/lib/i18n/localized";
import { routes } from "@/config/routes";

/**
 * BookingAddons — step 01 · Customise of the booking flow for one chosen
 * service: back link, step indicator, the shared editorial header, then the
 * interactive add-on customizer with the live appointment summary.
 */
export async function BookingAddons({
  service,
  addons,
  incompatiblePairs,
}: ServiceWithAddons) {
  const [t, locale] = await Promise.all([
    getTranslations("booking"),
    getLocale(),
  ]);

  const localizedService = {
    id: service.id,
    name:
      pickLocalized(locale, service.name_en, service.name_dk) ??
      service.name_en,
    priceCents: service.base_price_cents,
    durationMins: service.base_duration_mins,
  };
  const localizedAddons = addons.map((addon) => ({
    id: addon.id,
    name: pickLocalized(locale, addon.name_en, addon.name_dk) ?? addon.name_en,
    priceCents: addon.extra_price_cents,
    durationMins: addon.extra_duration_mins,
  }));

  return (
    <Section>
      <Container className="max-w-4xl">
        <div className="space-y-4 pb-8">
          <ArrowLink back href={routes.book} className="text-[10px]">
            {t("back")}
          </ArrowLink>
          <BookingSteps current={0} />
        </div>

        <Separator />

        <PageHeader
          className="py-16"
          eyebrow={t("eyebrow")}
          lead={t("headingLine1")}
          muted={t("headingLine2")}
          intro={t("addonsIntro")}
        />

        <BookingCustomizer
          service={localizedService}
          addons={localizedAddons}
          incompatiblePairs={incompatiblePairs}
        />
      </Container>
    </Section>
  );
}
