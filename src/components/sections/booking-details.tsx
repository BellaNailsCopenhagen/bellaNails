import { Show } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { getLocale, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
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
import { PHONE_HTML_PATTERN } from "@/lib/contact-validation";
import { pickLocalized } from "@/lib/i18n/localized";
import { routes } from "@/config/routes";

type ContactPrefill = {
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
};

/**
 * BookingDetails — step 02 · Your details: contact fields (prefilled into the
 * Cal.com embed at step 03) beside the same appointment summary as step 01.
 * The selection arrives via the URL (`?service=…&addons=a,b&step=details`),
 * so this step is shareable/refreshable and back-navigation keeps state.
 * Field defaults: URL values (back-navigation) win over the signed-in Clerk
 * profile; signed-out visitors get a sign-in prompt that returns here.
 */
export async function BookingDetails({
  service,
  addons,
  selectedAddonIds,
  prefill = {},
}: Pick<ServiceWithAddons, "service" | "addons"> & {
  selectedAddonIds: string[];
  prefill?: ContactPrefill;
}) {
  const [t, locale, user] = await Promise.all([
    getTranslations("booking"),
    getLocale(),
    currentUser(),
  ]);

  const clerkEmail =
    user?.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
  const clerkName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || undefined;
  const clerkPhone = user?.phoneNumbers[0]?.phoneNumber;

  const defaults = {
    name: prefill.name ?? clerkName,
    email: prefill.email ?? clerkEmail,
    phone: prefill.phone ?? clerkPhone,
    notes: prefill.notes,
  };

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

  // All three are required — enforced here natively (required/type/pattern,
  // browser-localized messages) and again at the /book routing gate
  // (`isCompleteContact`), so a hand-edited confirm URL can't skip them.
  const fields = [
    {
      id: "name",
      label: t("fields.fullName"),
      placeholder: t("fields.fullNamePlaceholder"),
      type: "text",
      autoComplete: "name",
      minLength: 2,
      pattern: undefined,
      defaultValue: defaults.name,
    },
    {
      id: "email",
      label: t("fields.email"),
      placeholder: t("fields.emailPlaceholder"),
      type: "email",
      autoComplete: "email",
      minLength: undefined,
      pattern: undefined,
      defaultValue: defaults.email,
    },
    {
      id: "phone",
      label: t("fields.phone"),
      placeholder: t("fields.phonePlaceholder"),
      type: "tel",
      autoComplete: "tel",
      minLength: undefined,
      pattern: PHONE_HTML_PATTERN,
      defaultValue: defaults.phone,
    },
  ] as const;

  // Where the sign-in flow should land back: this exact step with selection.
  const returnUrl = `/${locale}${routes.book}?${new URLSearchParams({
    service: service.id,
    step: "details",
    ...(selectedAddons.length
      ? { addons: selectedAddons.map((a) => a.id).join(",") }
      : {}),
  }).toString()}`;

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

        {/* Signed-out: offer sign-in (returning here) so the form can
            prefill from the Clerk profile. */}
        <Show when="signed-out">
          <BodySm className="pb-8 text-xs">
            {t.rich("signInPrompt", {
              link: (chunks) => (
                <Link
                  href={{
                    pathname: routes.signIn,
                    query: { redirect_url: returnUrl },
                  }}
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {chunks}
                </Link>
              ),
            })}
          </BodySm>
        </Show>

        <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between md:gap-16">
          {/* GET submit: the contact fields join the URL-driven flow state
              (`?service=…&addons=…&step=confirm&name=…`), keeping every step
              refreshable and back-button safe. */}
          <form
            method="get"
            action={`/${locale}${routes.book}`}
            className="w-full max-w-[25rem] space-y-10"
          >
            <input type="hidden" name="service" value={service.id} />
            {selectedAddons.length ? (
              <input
                type="hidden"
                name="addons"
                value={selectedAddons.map((a) => a.id).join(",")}
              />
            ) : null}
            <input type="hidden" name="step" value="confirm" />
            {fields.map((field) => (
              <div key={field.id} className="space-y-1">
                <Label
                  htmlFor={field.id}
                  className="text-[10px] tracking-widest-lux"
                >
                  {field.label}
                </Label>
                {/* Keyed by the default: uncontrolled inputs ignore a changed
                    defaultValue on re-render (Base UI warns), so a new value
                    from back-navigation remounts the field instead. */}
                <Input
                  key={field.defaultValue ?? ""}
                  id={field.id}
                  name={field.id}
                  type={field.type}
                  autoComplete={field.autoComplete}
                  placeholder={field.placeholder}
                  required
                  minLength={field.minLength}
                  pattern={field.pattern}
                  defaultValue={field.defaultValue}
                />
              </div>
            ))}

            <div className="space-y-1">
              <Label htmlFor="notes" className="text-[10px] tracking-widest-lux">
                {t("fields.notes")}
              </Label>
              <Textarea
                key={defaults.notes ?? ""}
                id="notes"
                name="notes"
                placeholder={t("fields.notesPlaceholder")}
                defaultValue={defaults.notes}
              />
            </div>

            <BodySm className="text-xs">{t("privacyNote")}</BodySm>

            <Button size="lg" type="submit">
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
