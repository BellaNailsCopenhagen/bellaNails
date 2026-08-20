import { getLocale, getTranslations } from "next-intl/server"

import { getCurrentUser } from "@/lib/identity/server"
import { SignedOut } from "@/components/auth/auth-gate"
import { getPathname, Link } from "@/i18n/navigation"
import { AppointmentSummary } from "@/components/sections/appointment-summary"
import { BookingStepHeader } from "@/components/sections/booking-step-header"
import { Container, Section } from "@/components/layout/container"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { BodySm } from "@/components/ui/typography"
import type { ServiceWithAddons } from "@/lib/services/get-service-with-addons"
import {
  EMAIL_HTML_PATTERN,
  MAX_NOTES_LENGTH,
  PHONE_HTML_PATTERN,
  type BookingContact,
} from "@/lib/contact-validation"
import { localizeSelection } from "@/lib/services/localize-selection"
import { routes } from "@/config/routes"

type Field = {
  id: "name" | "email" | "phone"
  label: string
  placeholder: string
  type: string
  autoComplete: string
  minLength?: number
  pattern?: string
  defaultValue?: string
}

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
  selectedAddonIds: string[]
  prefill?: BookingContact
}) {
  const [t, locale, user] = await Promise.all([
    getTranslations("booking"),
    getLocale(),
    getCurrentUser(),
  ])

  const defaults = {
    name: prefill.name ?? user?.name ?? undefined,
    email: prefill.email ?? user?.email ?? undefined,
    // Seed the +45 country code so clients enter a full E.164 number, not a
    // bare 8-digit local one (toE164 still backstops mis-entries).
    phone: prefill.phone ?? "+45 ",
    notes: prefill.notes,
  }

  const { service: localizedService, addons: selectedAddons } =
    localizeSelection(service, addons, locale, selectedAddonIds)

  const addonsParam = selectedAddons.length
    ? { addons: selectedAddons.map((a) => a.id).join(",") }
    : {}
  const backQuery = { service: service.id, ...addonsParam }

  // All three are required — enforced natively here (required/type/pattern,
  // browser-localized messages) and again at the /book routing gate
  // (`isCompleteContact`), using the same patterns so they can't disagree.
  const fields: Field[] = [
    {
      id: "name",
      label: t("fields.fullName"),
      placeholder: t("fields.fullNamePlaceholder"),
      type: "text",
      autoComplete: "name",
      minLength: 2,
      defaultValue: defaults.name,
    },
    {
      id: "email",
      label: t("fields.email"),
      placeholder: t("fields.emailPlaceholder"),
      type: "email",
      autoComplete: "email",
      pattern: EMAIL_HTML_PATTERN,
      defaultValue: defaults.email,
    },
    {
      id: "phone",
      label: t("fields.phone"),
      placeholder: t("fields.phonePlaceholder"),
      type: "tel",
      autoComplete: "tel",
      pattern: PHONE_HTML_PATTERN,
      defaultValue: defaults.phone,
    },
  ]

  const bookPath = getPathname({ locale, href: routes.book })
  // Where the sign-in flow should land back: this exact step with selection.
  const returnParams = new URLSearchParams({
    service: service.id,
    step: "details",
  })
  if (selectedAddons.length) {
    returnParams.set("addons", selectedAddons.map((a) => a.id).join(","))
  }
  const returnUrl = `${bookPath}?${returnParams.toString()}`

  return (
    <Section>
      <Container className="max-w-4xl">
        <BookingStepHeader
          current={1}
          backHref={{ pathname: routes.book, query: backQuery }}
          backLabel={t("backToCustomise")}
          eyebrow={t("eyebrow")}
          lead={t("headingDetails1")}
          muted={t("headingDetails2")}
          intro={t("detailsIntro")}
        />

        {/* Signed-out: offer sign-in (returning here) so the form can
            prefill from the account profile. */}
        <SignedOut>
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
        </SignedOut>

        <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between md:gap-16">
          {/* GET submit: the contact fields join the URL-driven flow state
              (`?service=…&addons=…&step=confirm&name=…`), keeping every step
              refreshable and back-button safe. Accepted trade-off (owner
              decision): contact data transits the query string — it reaches
              our own access logs/browser history but NOT third parties (the
              default strict-origin-when-cross-origin referrer policy strips
              path+query from the Cal iframe's Referer). */}
          <form
            method="get"
            action={bookPath}
            className="w-full space-y-10 md:max-w-[25rem]"
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
              <Label
                htmlFor="notes"
                className="text-[10px] tracking-widest-lux"
              >
                {t("fields.notes")}
              </Label>
              <Textarea
                key={defaults.notes ?? ""}
                id="notes"
                name="notes"
                placeholder={t("fields.notesPlaceholder")}
                maxLength={MAX_NOTES_LENGTH}
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
  )
}
