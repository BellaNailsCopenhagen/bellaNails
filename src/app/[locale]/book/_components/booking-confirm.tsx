import { getLocale, getTranslations } from "next-intl/server"

import { getPathname, Link } from "@/i18n/navigation"
import { AppointmentSummary } from "@/components/booking/appointment-summary"
import { BookingSlotStep } from "@/app/[locale]/book/_components/booking-slot-step"
import { BookingStepHeader } from "@/app/[locale]/book/_components/booking-step-header"
import { Container, Section } from "@/components/layout/container"
import { BodySm } from "@/components/ui/typography"
import { serviceRef } from "@/shared/booking-subject"
import { localizeSelection } from "@/shared/localize-selection"
import { getBookingSlots, getMaxAdvanceDays } from "@/modules/booking"
import type { ServiceWithAddons } from "@/modules/catalog"
import {
  bookingFlowQuery,
  type BookingContact,
} from "@/shared/contact-validation"
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
  humanCheck,
}: Pick<ServiceWithAddons, "service" | "addons"> & {
  selectedAddonIds: string[]
  prefill: BookingContact
  /** Her switch, AND a signing secret to back it. Off → no box, and the action
      doesn't ask for a proof either. */
  humanCheck: boolean
}) {
  const [t, locale, calendars, maxAdvanceDays] = await Promise.all([
    getTranslations("booking"),
    getLocale(),
    // Both calendars in one pass — outside is [] when the studio hasn't enabled it.
    getBookingSlots(serviceRef(service.id, selectedAddonIds)),
    getMaxAdvanceDays(),
  ])
  const { normal: slots, outsideEnabled } = calendars

  const { service: localizedService, addons: selectedAddons } =
    localizeSelection(service, addons, locale, selectedAddonIds)

  // Where sign-in should land if the session lapses between here and the
  // booking tap: this exact picker, selection and details intact.
  const signInReturnPath = `${getPathname({ locale, href: routes.book })}?${bookingFlowQuery(
    {
      serviceId: service.id,
      addonIds: selectedAddons.map((a) => a.id),
      step: "confirm",
      contact: prefill,
    },
  )}`

  // Carry the contact fields back so the details form re-renders filled —
  // state lives in the URL across the whole flow. Same builder as the sign-in
  // return path, so the two can't disagree about what "everything" is.
  const backQuery = Object.fromEntries(
    bookingFlowQuery({
      serviceId: service.id,
      addonIds: selectedAddons.map((a) => a.id),
      step: "details",
      contact: prefill,
    }),
  )

  return (
    <Section>
      <Container className="max-w-4xl">
        <BookingStepHeader
          current={2}
          skipCustomise={addons.length === 0}
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
              signInReturnPath={signInReturnPath}
              humanLabels={
                humanCheck
                  ? {
                      prompt: t("humanPrompt"),
                      working: t("humanWorking"),
                      done: t("humanDone"),
                      failed: t("humanFailed"),
                      note: t("humanNote"),
                    }
                  : null
              }
              serviceId={service.id}
              addonIds={selectedAddons.map((a) => a.id)}
              slots={slots}
              maxAdvanceDays={maxAdvanceDays}
              prefill={prefill}
              outsideEnabled={outsideEnabled}
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
