import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { Display, Eyebrow, Lead } from "@/components/ui/typography";
import { LocaleToggle } from "@/components/locale-toggle";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const t = await getTranslations("home");

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <LocaleToggle className="absolute top-6 right-6" />
      <Eyebrow>{t("eyebrow")}</Eyebrow>
      <Display className="mt-6">{t("title")}</Display>
      <Lead className="mt-5 max-w-md">{t("tagline")}</Lead>
      <div className="mt-10 h-px w-16 bg-border" aria-hidden />
    </main>
  );
}
