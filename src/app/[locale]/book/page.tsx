import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { BookingAddons } from "@/components/sections/booking-addons";
import { BookingDetails } from "@/components/sections/booking-details";
import { BookingServicePicker } from "@/components/sections/booking-service-picker";
import { getServiceWithAddons } from "@/lib/services/get-service-with-addons";

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
 * An unknown/archived/malformed id falls back to the picker rather than
 * 404ing the flow.
 */
export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    service?: string | string[];
    addons?: string | string[];
    step?: string | string[];
  }>;
}) {
  const [{ locale }, { service, addons, step }] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const selection =
    typeof service === "string" ? await getServiceWithAddons(service) : null;
  const selectedAddonIds =
    typeof addons === "string" ? addons.split(",").filter(Boolean) : [];

  return (
    <main className="flex flex-1 flex-col">
      {selection && step === "details" ? (
        <BookingDetails
          service={selection.service}
          addons={selection.addons}
          selectedAddonIds={selectedAddonIds}
        />
      ) : selection ? (
        <BookingAddons {...selection} />
      ) : (
        <BookingServicePicker />
      )}
    </main>
  );
}
