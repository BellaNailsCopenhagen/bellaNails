import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { BookingAddons } from "@/components/sections/booking-addons";
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
 * /book — the booking flow. Without `?service=`: the treatment picker.
 * With `?service=<uuid>`: that service's customise step (01 — add-ons).
 * An unknown/archived/malformed id falls back to the picker rather than
 * 404ing the flow.
 */
export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ service?: string | string[] }>;
}) {
  const [{ locale }, { service }] = await Promise.all([params, searchParams]);
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const selection =
    typeof service === "string" ? await getServiceWithAddons(service) : null;

  return (
    <main className="flex flex-1 flex-col">
      {selection ? <BookingAddons {...selection} /> : <BookingServicePicker />}
    </main>
  );
}
