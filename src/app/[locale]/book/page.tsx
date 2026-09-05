import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { redirect } from "@/i18n/navigation"
import { routing } from "@/i18n/routing"
import { routes } from "@/config/routes"
import { BookingAddons } from "@/app/[locale]/book/_components/booking-addons"
import { BookingConfirm } from "@/app/[locale]/book/_components/booking-confirm"
import { BookingDetails } from "@/app/[locale]/book/_components/booking-details"
import { BookingServicePicker } from "@/app/[locale]/book/_components/booking-service-picker"
import {
  isCompleteContact,
  MAX_NAME_LENGTH,
  MAX_NOTES_LENGTH,
  sanitizeContactText,
} from "@/shared/contact-validation"
import { sanitizeSelectedAddonIds } from "@/shared/booking-totals"
import { getServiceWithAddons } from "@/modules/catalog"
import { getCurrentUser } from "@/modules/identity/server"
import { getBookingProtectionSettings } from "@/modules/booking/protection"
import { humanCheckConfigured } from "@/modules/identity/human-check"
import { requiresVerifiedIdentity } from "@/shared/booking-protection"
import { singleParam } from "@/shared/search-params"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }
  const t = await getTranslations({ locale, namespace: "booking" })

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  }
}

/**
 * /book — the booking flow, driven by the URL so every step is shareable,
 * refreshable, and back-button friendly:
 *   - no `?service=`                       → treatment picker
 *   - `?service=<uuid>`                    → step 01 · customise (add-ons)
 *   - `?service=<uuid>&step=details[&addons=a,b]` → step 02 · your details
 *   - `?service=<uuid>&step=confirm[&addons=…]&name=…&phone=…` → step 03 · pick a time
 * An unknown/archived/malformed id falls back to the picker. Step 03 needs a
 * signed-in visitor with complete contact data; anything less degrades to step
 * 02, which is where the sign-in gate lives. No email in the URL — it is the
 * session's.
 */
export default async function BookPage({
  params,
  searchParams,
}: PageProps<"/[locale]/book">) {
  const [{ locale }, query] = await Promise.all([params, searchParams])
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }
  setRequestLocale(locale)

  const service = singleParam(query.service)
  const step = singleParam(query.step)
  // At the `open` level a signed-out visitor may reach step 03, and only then
  // does the flow have to carry an email of its own (App settings → Booking
  // protection).
  const protection = await getBookingProtectionSettings()
  const signInRequired = requiresVerifiedIdentity(protection.accessLevel)
  // Her switch AND a secret to sign challenges with — without one the box could
  // only ever spin, so it isn't shown and the action lets the check pass.
  const humanCheck = protection.humanCheck && humanCheckConfigured()
  // Only step 03 gates on the session. The details step asks for itself (the
  // read is request-cached), and the picker / add-on steps shouldn't pay for a
  // lookup they never use.
  const signedIn =
    step === "confirm" && signInRequired ? Boolean(await getCurrentUser()) : true
  const selection = service ? await getServiceWithAddons(service) : null
  const selectedAddonIds = selection
    ? // Server-side counterpart of the customizer's checkbox locking: drop
      // unknown ids and incompatible combinations a crafted URL could carry.
      sanitizeSelectedAddonIds(
        singleParam(query.addons)?.split(",").filter(Boolean) ?? [],
        selection.addons,
        selection.incompatiblePairs,
      )
    : []

  // HTML constraints are bypassable via a hand-edited GET URL — re-clamp here.
  const contact = {
    name: sanitizeContactText(singleParam(query.name), MAX_NAME_LENGTH) ?? undefined,
    // Only meaningful with the sign-in gate off — see BookingContact.
    email: singleParam(query.email)?.trim(),
    phone: singleParam(query.phone)?.trim(),
    notes:
      sanitizeContactText(singleParam(query.notes), MAX_NOTES_LENGTH, {
        allowNewlines: true,
      }) ?? undefined,
    // Honeypot — carried from the details form's hidden non-autocomplete field.
    honeypot: singleParam(query.contact_reason_x)?.trim(),
  }

  const renderStep = () => {
    if (!selection) return <BookingServicePicker />
    // Confirm requires complete, well-formed contact data — a hand-edited URL
    // that skips the form degrades to the details step.
    // Sending a signed-out visitor to the time picker would only fail at the
    // last tap (create-booking-actions.ts is the real boundary).
    if (
      step === "confirm" &&
      signedIn &&
      isCompleteContact(contact, { requireEmail: !signInRequired })
    ) {
      return (
        <BookingConfirm
          service={selection.service}
          addons={selection.addons}
          selectedAddonIds={selectedAddonIds}
          prefill={contact}
          humanCheck={humanCheck}
        />
      )
    }
    if (step === "details" || step === "confirm") {
      return (
        <BookingDetails
          service={selection.service}
          addons={selection.addons}
          selectedAddonIds={selectedAddonIds}
          prefill={contact}
          signInRequired={signInRequired}
        />
      )
    }
    // No add-ons to choose — skip the customise step, straight to details.
    if (selection.addons.length === 0) {
      redirect({
        href: {
          pathname: routes.book,
          query: { service: selection.service.id, step: "details" },
        },
        locale,
      })
    }
    return <BookingAddons {...selection} selectedAddonIds={selectedAddonIds} />
  }

  return <main className="flex flex-1 flex-col">{renderStep()}</main>
}
