import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { routing } from "@/i18n/routing"
import { BookingAddons } from "@/components/sections/booking-addons"
import { BookingConfirm } from "@/components/sections/booking-confirm"
import { BookingDetails } from "@/components/sections/booking-details"
import { BookingServicePicker } from "@/components/sections/booking-service-picker"
import { isCompleteContact } from "@/lib/contact-validation"
import { sanitizeSelectedAddonIds } from "@/lib/services/booking-totals"
import { getServiceWithAddons } from "@/lib/services/get-service-with-addons"
import { singleParam } from "@/lib/search-params"
import { CALCOM_USERNAME } from "@/config/calcom"

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
 *   - `?service=<uuid>&step=confirm[&addons=…]&name=…&email=…` → step 03 · embed
 * An unknown/archived/malformed id falls back to the picker; step=confirm
 * without a Cal slug (column not yet seeded) degrades to step 02.
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

  const contact = {
    name: singleParam(query.name),
    email: singleParam(query.email),
    phone: singleParam(query.phone),
    notes: singleParam(query.notes),
  }

  // Confirm needs the Cal identity to exist — a null slug or missing Cal
  // username is a config gap, not a user error: log it loudly and degrade.
  const calReady = Boolean(selection?.service.cal_event_slug && CALCOM_USERNAME)
  if (step === "confirm" && selection && !calReady) {
    console.error("[book] confirm unavailable: missing Cal config", {
      serviceId: selection.service.id,
      hasSlug: Boolean(selection.service.cal_event_slug),
      hasUsername: Boolean(CALCOM_USERNAME),
    })
  }

  const renderStep = () => {
    if (!selection) return <BookingServicePicker />
    // Confirm requires the Cal config AND complete, well-formed contact
    // data — a hand-edited URL that skips the form degrades to details.
    if (step === "confirm" && calReady && isCompleteContact(contact)) {
      return (
        <BookingConfirm
          service={selection.service}
          addons={selection.addons}
          selectedAddonIds={selectedAddonIds}
          prefill={contact}
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
        />
      )
    }
    return <BookingAddons {...selection} selectedAddonIds={selectedAddonIds} />
  }

  return <main className="flex flex-1 flex-col">{renderStep()}</main>
}
