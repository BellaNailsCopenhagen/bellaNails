import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { BookingServicePicker } from "@/components/sections/booking-service-picker";

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
 * /book — the booking flow. Step 1 (this page, no `?service=`): pick a
 * treatment. Step 2 (`?service=<uuid>`, next up): that service's add-on
 * selection — until it ships, the param simply re-renders the picker.
 */
export default async function BookPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <main className="flex flex-1 flex-col">
      <BookingServicePicker />
    </main>
  );
}
