import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Confirmation } from "@/components/sections/confirmation";
import { routing } from "@/i18n/routing";
import { EMAIL_PATTERN } from "@/lib/contact-validation";
import { singleParam } from "@/lib/search-params";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "confirmation" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    // Personal post-booking page — never in a search index.
    robots: { index: false, follow: false },
  };
}

export default async function ConfirmationPage({
  params,
  searchParams,
}: PageProps<"/[locale]/confirmation">) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const uid = singleParam(query.uid) ?? null;
  const rawEmail = singleParam(query.email);
  // Only forward a sane address into the sign-up prefill.
  const email = rawEmail && EMAIL_PATTERN.test(rawEmail) ? rawEmail : null;

  return (
    <main className="flex flex-1 flex-col">
      <Confirmation uid={uid} email={email} />
    </main>
  );
}
