import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { BookingAddons } from "@/components/sections/booking-addons";
import { BookingConfirm } from "@/components/sections/booking-confirm";
import { BookingDetails } from "@/components/sections/booking-details";
import { BookingServicePicker } from "@/components/sections/booking-service-picker";
import { isCompleteContact } from "@/lib/contact-validation";
import { getServiceWithAddons } from "@/lib/services/get-service-with-addons";

/** First value when a query param repeats; undefined when absent. */
function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  const t = await getTranslations({ locale, namespace: "booking" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
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
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const service = single(query.service);
  const step = single(query.step);
  const selection = service ? await getServiceWithAddons(service) : null;
  const selectedAddonIds = single(query.addons)?.split(",").filter(Boolean) ?? [];

  const contact = {
    name: single(query.name),
    email: single(query.email),
    phone: single(query.phone),
    notes: single(query.notes),
  };

  const renderStep = () => {
    if (!selection) return <BookingServicePicker />;
    // Confirm requires a Cal slug AND complete, well-formed contact data —
    // a hand-edited URL that skips the form degrades to the details step.
    if (
      step === "confirm" &&
      selection.service.cal_event_slug &&
      isCompleteContact(contact)
    ) {
      return (
        <BookingConfirm
          service={selection.service}
          addons={selection.addons}
          selectedAddonIds={selectedAddonIds}
          prefill={contact}
        />
      );
    }
    if (step === "details" || step === "confirm") {
      return (
        <BookingDetails
          service={selection.service}
          addons={selection.addons}
          selectedAddonIds={selectedAddonIds}
          prefill={contact}
        />
      );
    }
    return <BookingAddons {...selection} />;
  };

  return <main className="flex flex-1 flex-col">{renderStep()}</main>;
}
