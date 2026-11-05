import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { routing } from "@/i18n/routing"
import { alternatesFor } from "@/config/site"
import { routes } from "@/config/routes"
import { ServiceMenu } from "@/app/[locale]/services/_components/service-menu"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }
  const t = await getTranslations({ locale, namespace: "serviceMenu" })

  const alternates = alternatesFor(locale, routes.services)

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates,
    // Canonical URL for the Open Graph card when the page is shared.
    // `alternatesFor` always returns a string canonical (built by localeUrl).
    openGraph: { url: alternates!.canonical as string },
  }
}

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }
  setRequestLocale(locale)

  return (
    <main className="flex flex-1 flex-col">
      <ServiceMenu />
    </main>
  )
}
