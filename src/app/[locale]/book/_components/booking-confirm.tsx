import { getLocale, getTranslations } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { AppointmentSummary } from "@/components/booking/appointment-summary"
import { BookingSlotStep } from "@/app/[locale]/book/_components/booking-slot-step"
import { BookingStepHeader } from "@/app/[locale]/book/_components/booking-step-header"
import { Container, Section } from "@/components/layout/container"
import { BodySm } from "@/components/ui/typography"
import { localizeSelection } from "@/shared/localize-selection"
import { getAvailableSlots, getMaxAdvanceDays } from "@/modules/booking"
import type { ServiceWithAddons } from "@/modules/catalog"
import type { BookingContact } from "@/shared/contact-validation"
import { routes } from "@/config/routes"

/**
 * BookingConfirm — step 03 · Confirm: the in-house date + time picker for the
 * chosen service (+ add-ons), beside the running total. Availability is computed
 * server-side from the studio schedule and existing bookings; the picker calls
 * createBooking and routes on to /confirmation. The /book routing gate
 * guarantees `prefill` is complete before this renders.
 */
export async function BookingConfirm({
  service,
  addons,
  selectedAddonIds,
  prefill,
}: Pick<ServiceWithAddons, "service" | "addons"> & {
  selectedAddonIds: string[]
  prefill: BookingContact
}) {
  const [t, locale, slots, maxAdvanceDays] = await Promise.all([
    getTranslations("booking"),
    getLocale(),
    getAvailableSlots(service.id, selectedAddonIds),
    getMaxAdvanceDays(),
  ])

  const { service: localizedService, addons: selectedAddons } =
    localizeSelection(service, addons, locale, selectedAddonIds)

  // Carry the contact fields back so the details form re-renders filled —
  // state lives in the URL across the whole flow.
  const backQuery = {
    service: service.id,
    step: "details",
    ...(selectedAddons.length
      ? { addons: selectedAddons.map((a) => a.id).join(",") }
      : {}),
    ...(prefill.name ? { name: prefill.name } : {}),
    ...(prefill.email ? { email: prefill.email } : {}),
    ...(prefill.phone ? { phone: prefill.phone } : {}),
    ...(prefill.notes ? { notes: prefill.notes } : {}),
  }

  return (
    <Section>
      <Container className="max-w-4xl">
        <BookingStepHeader
          current={2}
          backHref={{ pathname: routes.book, query: backQuery }}
          backLabel={t("backToDetails")}
          eyebrow={t("eyebrow")}
          lead={t("headingConfirm1")}
          muted={t("headingConfirm2")}
          intro={t("confirmIntro")}
        />

        <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between md:gap-16">
          <div className="w-full min-w-0 flex-1 space-y-6">
            <BookingSlotStep
              serviceId={service.id}
              addonIds={selectedAddons.map((a) => a.id)}
              slots={slots}
              maxAdvanceDays={maxAdvanceDays}
              prefill={prefill}
            />

            <BodySm className="text-xs">
              {t.rich("consent", {
                terms: (chunks) => (
                  <Link
                    href={routes.terms}
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    {chunks}
                  </Link>
                ),
                privacy: (chunks) => (
                  <Link
                    href={routes.privacy}
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </BodySm>
          </div>

          <AppointmentSummary
            service={localizedService}
            selectedAddons={selectedAddons}
            showTimeNote={false}
          />
        </div>
      </Container>
    </Section>
  )
}
