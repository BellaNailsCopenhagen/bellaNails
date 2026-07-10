import { Show } from "@clerk/nextjs";
import { getLocale, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { AccountOptIn } from "@/components/sections/account-opt-in";
import {
  AppointmentSummary,
  type BookingLineItem,
} from "@/components/sections/appointment-summary";
import { BookingEmbed } from "@/components/sections/booking-embed";
import { BookingSteps } from "@/components/sections/booking-steps";
import { Container, Section } from "@/components/layout/container";
import { ArrowLink } from "@/components/ui/arrow-link";
import { PageHeader } from "@/components/ui/page-header";
import { formatPrice } from "@/components/ui/price-tag";
import { Separator } from "@/components/ui/separator";
import { BodySm } from "@/components/ui/typography";
import { computeBookingTotals } from "@/lib/services/booking-totals";
import type { ServiceWithAddons } from "@/lib/services/get-service-with-addons";
import { pickLocalized } from "@/lib/i18n/localized";
import { buildCalLink } from "@/config/calcom";
import { routes } from "@/config/routes";

type ContactPrefill = {
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
};

/**
 * BookingConfirm — step 03 · Confirm: the themed Cal.com embed pre-loaded
 * with the chosen service's event type, the computed (rounded-up) slot
 * length, contact prefill from step 02, a locale-aware notes summary, and
 * IDs-only metadata for the webhook. Cal owns availability and date/time —
 * this step owns nothing but the handoff.
 */
export async function BookingConfirm({
  service,
  addons,
  selectedAddonIds,
  prefill,
}: Pick<ServiceWithAddons, "service" | "addons"> & {
  selectedAddonIds: string[];
  prefill: ContactPrefill;
}) {
  const [t, locale] = await Promise.all([
    getTranslations("booking"),
    getLocale(),
  ]);

  const toLineItem = (
    id: string,
    nameEn: string,
    nameDk: string | null,
    priceCents: number,
    durationMins: number,
  ): BookingLineItem => ({
    id,
    name: pickLocalized(locale, nameEn, nameDk) ?? nameEn,
    priceCents,
    durationMins,
  });

  const localizedService = toLineItem(
    service.id,
    service.name_en,
    service.name_dk,
    service.base_price_cents,
    service.base_duration_mins,
  );
  const selectedAddons = addons
    .filter((addon) => selectedAddonIds.includes(addon.id))
    .map((addon) =>
      toLineItem(
        addon.id,
        addon.name_en,
        addon.name_dk,
        addon.extra_price_cents,
        addon.extra_duration_mins,
      ),
    );

  const { totalCents, totalMins, slotMins } = computeBookingTotals(
    localizedService,
    selectedAddons,
  );

  // Human-readable, locale-aware — what the artist and the client read in
  // the booking notes/emails. The webhook never parses this string.
  const notesSummary = [
    `${localizedService.name} (${localizedService.durationMins} min)`,
    ...selectedAddons.map(
      (addon) => `${addon.name} (+${addon.durationMins} min)`,
    ),
  ]
    .join(" + ")
    .concat(
      ` · ${t("notesTotal")} ${totalMins} min · ${formatPrice(totalCents, "da-DK", "DKK", false)}`,
    );

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
  };

  return (
    <Section>
      <Container className="max-w-4xl">
        <div className="space-y-4 pb-8">
          <ArrowLink
            back
            href={{ pathname: routes.book, query: backQuery }}
            className="text-[10px]"
          >
            {t("backToDetails")}
          </ArrowLink>
          <BookingSteps current={2} />
        </div>

        <Separator />

        <PageHeader
          className="py-16"
          eyebrow={t("eyebrow")}
          lead={t("headingConfirm1")}
          muted={t("headingConfirm2")}
          intro={t("confirmIntro")}
        />

        {/* Full-width, above the columns, signed-out only — the embed and
            the summary card start on the same top line. */}
        <Show when="signed-out">
          <div className="pb-8">
            <AccountOptIn />
          </div>
        </Show>

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
          />
        </div>
      </Container>
    </Section>
  );
}
