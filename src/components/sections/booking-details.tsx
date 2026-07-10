import { getLocale, getTranslations } from "next-intl/server";

import {
  AppointmentSummary,
  type BookingLineItem,
} from "@/components/sections/appointment-summary";
import { BookingSteps } from "@/components/sections/booking-steps";
import { Container, Section } from "@/components/layout/container";
import { ArrowLink } from "@/components/ui/arrow-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { BodySm } from "@/components/ui/typography";
import type { ServiceWithAddons } from "@/lib/services/get-service-with-addons";
import { pickLocalized } from "@/lib/i18n/localized";
import { routes } from "@/config/routes";

/**
 * BookingDetails — step 02 · Your details: contact fields (prefilled into the
 * Cal.com embed at step 03) beside the same appointment summary as step 01.
 * The selection arrives via the URL (`?service=…&addons=a,b&step=details`),
 * so this step is shareable/refreshable and back-navigation keeps state.
 */
export async function BookingDetails({
  service,
  addons,
  selectedAddonIds,
}: Pick<ServiceWithAddons, "service" | "addons"> & {
  selectedAddonIds: string[];
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
  // Only ids that are real add-ons of this service survive (a tampered or
  // stale `addons` param degrades to "not selected", never a wrong price).
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

  const backQuery = {
    service: service.id,
    ...(selectedAddons.length
      ? { addons: selectedAddons.map((a) => a.id).join(",") }
      : {}),
  };

  const fields = [
    {
      id: "name",
      label: t("fields.fullName"),
      placeholder: t("fields.fullNamePlaceholder"),
      type: "text",
      autoComplete: "name",
      required: true,
    },
    {
      id: "email",
      label: t("fields.email"),
      placeholder: t("fields.emailPlaceholder"),
      type: "email",
      autoComplete: "email",
      required: true,
    },
    {
      id: "phone",
      label: t("fields.phone"),
      placeholder: t("fields.phonePlaceholder"),
      type: "tel",
      autoComplete: "tel",
      required: false,
    },
  ] as const;

  return (
    <Section>
      <Container className="max-w-4xl">
        <div className="space-y-4 pb-8">
          <ArrowLink
            back
            href={{ pathname: routes.book, query: backQuery }}
            className="text-[10px]"
          >
            {t("backToCustomise")}
          </ArrowLink>
          <BookingSteps current={1} />
        </div>

        <Separator />

        <PageHeader
          className="py-16"
          eyebrow={t("eyebrow")}
          lead={t("headingDetails1")}
          muted={t("headingDetails2")}
          intro={t("detailsIntro")}
        />

        <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between md:gap-16">
          {/* Submission lands with step 03 (Cal.com embed prefill). */}
          <form className="w-full max-w-[25rem] space-y-10">
            {fields.map((field) => (
              <div key={field.id} className="space-y-1">
                <Label
                  htmlFor={field.id}
                  className="text-[10px] tracking-widest-lux"
                >
                  {field.label}
                </Label>
                <Input
                  id={field.id}
                  name={field.id}
                  type={field.type}
                  autoComplete={field.autoComplete}
                  placeholder={field.placeholder}
                  required={field.required}
                />
              </div>
            ))}

            <div className="space-y-1">
              <Label htmlFor="notes" className="text-[10px] tracking-widest-lux">
                {t("fields.notes")}
              </Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder={t("fields.notesPlaceholder")}
              />
            </div>

            <BodySm className="text-xs">{t("privacyNote")}</BodySm>

            {/* Enabled once step 03 (time selection/embed) exists. */}
            <Button size="lg" disabled>
              {t("confirmCta")}
            </Button>
          </form>

          <AppointmentSummary
            service={localizedService}
            selectedAddons={selectedAddons}
          />
        </div>
      </Container>
    </Section>
  );
}
