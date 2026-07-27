import { getLocale, getTranslations } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { AppointmentSummary } from "@/components/sections/appointment-summary"
import { BookingEmbed } from "@/components/sections/booking-embed"
import { BookingStepHeader } from "@/components/sections/booking-step-header"
import { Container, Section } from "@/components/layout/container"
import { formatPrice } from "@/components/ui/price-tag"
import { BodySm } from "@/components/ui/typography"
import { computeBookingTotals } from "@/lib/services/booking-totals"
import { localizeSelection } from "@/lib/services/localize-selection"
import type { ServiceWithAddons } from "@/lib/services/get-service-with-addons"
import type { BookingContact } from "@/lib/contact-validation"
import { buildCalLink } from "@/config/calcom"
import { routes } from "@/config/routes"
import { SITE_URL } from "@/config/site"

/**
 * BookingConfirm — step 03 · Confirm: the themed Cal.com embed pre-loaded
 * with the chosen service's event type, the computed (rounded-up) slot
 * length, contact prefill from step 02, a locale-aware notes summary, and
 * IDs-only metadata. Cal owns availability and date/time — this step owns
 * nothing but the handoff. The /book routing gate guarantees `prefill` is
 * complete and the service has a Cal slug before this renders.
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
  const [t, locale] = await Promise.all([
    getTranslations("booking"),
    getLocale(),
  ])

  const { service: localizedService, addons: selectedAddons } =
    localizeSelection(service, addons, locale, selectedAddonIds)

  const { totalCents, totalMins, slotMins } = computeBookingTotals(
    localizedService,
    selectedAddons,
  )

  // Human-readable, locale-aware — what the artist and the client read in
  // the booking notes/emails. The webhook never parses this string; the
  // price uses formatPrice's site-wide defaults. The manage line rides along
  // because Cal's own email buttons can't be repointed at our pages.
  const notesSummary = [
    `${localizedService.name} (${localizedService.durationMins} min)`,
    ...selectedAddons.map(
      (addon) => `${addon.name} (+${addon.durationMins} min)`,
    ),
  ]
    .join(" + ")
    .concat(
      ` · ${t("notesTotal")} ${totalMins} min · ${formatPrice(totalCents)}`,
      `\n${t("manageOnline")}: ${SITE_URL}/${locale}${routes.appointments}`,
    )

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

        {/* Account creation is not opt-in: the webhook keys every booking to
            a Clerk identity. The conversion moment (verify email → manage
            bookings) lives on /confirmation, not here. */}
        <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between md:gap-16">
          <div className="w-full min-w-0 flex-1 space-y-6">
            <BookingEmbed
              calLink={buildCalLink(service.cal_event_slug ?? "")}
              slotMins={slotMins}
              prefill={prefill}
              notesSummary={notesSummary}
              metadata={{
                serviceId: service.id,
                addonIds: selectedAddons.map((a) => a.id),
                totalPriceCents: totalCents,
                totalDurationMins: totalMins,
                locale,
                clientNotes: prefill.notes,
              }}
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
