import { getLocale, getTranslations } from "next-intl/server"

import { BookingCustomizer } from "@/components/sections/booking-customizer"
import { BookingStepHeader } from "@/components/sections/booking-step-header"
import { Container, Section } from "@/components/layout/container"
import type { ServiceWithAddons } from "@/lib/services/get-service-with-addons"
import { localizeSelection } from "@/lib/services/localize-selection"
import { routes } from "@/config/routes"

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
  ])

  const { service: localizedService, addons: localizedAddons } =
    localizeSelection(service, addons, locale)

  return (
    <Section>
      <Container className="max-w-4xl">
        <BookingStepHeader
          current={0}
          backHref={routes.book}
          backLabel={t("back")}
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
  )
}
