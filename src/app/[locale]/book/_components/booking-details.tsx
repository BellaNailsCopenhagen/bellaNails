import { getLocale, getTranslations } from "next-intl/server"

import { getCurrentUser } from "@/modules/identity/server"
import { getPathname, Link } from "@/i18n/navigation"
import { AppointmentSummary } from "@/components/booking/appointment-summary"
import { BookingStepHeader } from "@/app/[locale]/book/_components/booking-step-header"
import { Container, Section } from "@/components/layout/container"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { BodySm } from "@/components/ui/typography"
import type { ServiceWithAddons } from "@/modules/catalog"
import {
  bookingFlowQuery,
  EMAIL_HTML_PATTERN,
  MAX_NOTES_LENGTH,
  PHONE_HTML_PATTERN,
  type BookingContact,
} from "@/shared/contact-validation"
import { localizeSelection } from "@/shared/localize-selection"
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
 * BookingDetails — step 02 · Your details: contact fields (carried into the
 * confirm step) beside the same appointment summary as step 01.
 * The selection arrives via the URL (`?service=…&addons=a,b&step=details`),
 * so this step is shareable/refreshable and back-navigation keeps state.
 * Field defaults: URL values (back-navigation) win over the signed-in user's
 * profile.
 *
 * **This is where the spam gate sits.** Browsing services and availability
 * stays open to everyone; the ask for a verified email comes once there is a
 * selection worth keeping, and the return URL carries it so nothing is lost.
 * The email itself is never a field — it is the session's, which is the whole
 * point of the gate and also keeps contact data out of the query string.
 */
export async function BookingDetails({
  service,
  addons,
  selectedAddonIds,
  prefill = {},
  signInRequired,
}: Pick<ServiceWithAddons, "service" | "addons"> & {
  selectedAddonIds: string[]
  prefill?: BookingContact
  /** The artist's switch (App settings → Spam & abuse). Off → guests may book,
      so the form has to ask for an email of its own. */
  signInRequired: boolean
}) {
  const [t, locale, user] = await Promise.all([
    getTranslations("booking"),
    getLocale(),
    getCurrentUser(),
  ])

  const defaults = {
    name: prefill.name ?? user?.name ?? undefined,
    email: prefill.email ?? user?.email ?? undefined,
    // A signed-in client's saved phone wins; otherwise seed the +45 country code
    // so they enter a full E.164 number (toE164 still backstops mis-entries).
    phone: prefill.phone ?? user?.phone ?? "+45 ",
    notes: prefill.notes,
  }

  const { service: localizedService, addons: selectedAddons } =
    localizeSelection(service, addons, locale, selectedAddonIds)

  const addonsParam = selectedAddons.length
    ? { addons: selectedAddons.map((a) => a.id).join(",") }
    : {}
  const backQuery = { service: service.id, ...addonsParam }
  // No add-ons on this service → the customise step is skipped; back = picker.
  const hasAddons = addons.length > 0

  // Every field shown is required — enforced natively here (required/type/
  // pattern, browser-localized messages) and again at the /book routing gate
  // (`isCompleteContact`), using the same patterns so they can't disagree.
  // Email only appears when the session isn't supplying it.
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
    ...(signInRequired
      ? []
      : [
          {
            id: "email" as const,
            label: t("fields.email"),
            placeholder: t("fields.emailPlaceholder"),
            type: "email",
            autoComplete: "email",
            pattern: EMAIL_HTML_PATTERN,
            defaultValue: defaults.email,
          },
        ]),
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
  // Where the sign-in flow should land back: this exact step, selection and
  // anything already typed intact.
  const returnUrl = `${bookPath}?${bookingFlowQuery({
    serviceId: service.id,
    addonIds: selectedAddons.map((a) => a.id),
    step: "details",
    contact: prefill,
  })}`

  // The gate only stands when the artist has it switched on.
  if (signInRequired && !user) {
    return (
      <Section>
        <Container className="max-w-4xl">
          <BookingStepHeader
            current={1}
            skipCustomise={!hasAddons}
            backHref={
              hasAddons ? { pathname: routes.book, query: backQuery } : routes.book
            }
            backLabel={hasAddons ? t("backToCustomise") : t("back")}
            eyebrow={t("eyebrow")}
            lead={t("headingSignIn1")}
            muted={t("headingSignIn2")}
            intro={t("signInIntro")}
          />

          <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between md:gap-16">
            <div className="w-full space-y-6 md:max-w-[25rem]">
              <BodySm className="text-xs">{t("signInWhy")}</BodySm>
              <Button
                size="lg"
                nativeButton={false}
                render={
                  <Link
                    href={{
                      pathname: routes.signIn,
                      query: { next: returnUrl },
                    }}
                  />
                }
              >
                {t("signInCta")}
              </Button>
              <BodySm className="text-xs">{t("signInKeepsSelection")}</BodySm>
            </div>

            <AppointmentSummary
              service={localizedService}
              selectedAddons={selectedAddons}
            />
          </div>
        </Container>
      </Section>
    )
  }

  return (
    <Section>
      <Container className="max-w-4xl">
        <BookingStepHeader
          current={1}
          skipCustomise={!hasAddons}
          backHref={
            hasAddons ? { pathname: routes.book, query: backQuery } : routes.book
          }
          backLabel={hasAddons ? t("backToCustomise") : t("back")}
          eyebrow={t("eyebrow")}
          lead={t("headingDetails1")}
          muted={t("headingDetails2")}
          intro={t("detailsIntro")}
        />

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
            {/* Not a field while the gate is on: the address comes from the
                session, so it can't be typed wrong, spoofed, or left in the URL. */}
            {signInRequired ? (
              <BodySm className="text-xs">
                {t("bookingAs", { email: user?.email ?? "" })}
              </BodySm>
            ) : null}
            {/* Honeypot: off-screen + aria-hidden + not tabbable, so neither
                sighted nor screen-reader users ever fill it. A non-autocomplete
                name so browsers/password managers won't autofill it; a bot that
                fills it is rejected server-side in createBooking. */}
            <input
              type="text"
              name="contact_reason_x"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              defaultValue=""
              className="pointer-events-none absolute -left-[9999px] h-px w-px opacity-0"
            />
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
              {t("toTimeCta")}
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
