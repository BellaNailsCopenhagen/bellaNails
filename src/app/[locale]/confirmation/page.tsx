import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { Confirmation } from "@/app/[locale]/confirmation/_components/confirmation"
import { routing } from "@/i18n/routing"
import { singleParam } from "@/shared/search-params"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  const t = await getTranslations({ locale, namespace: "confirmation" })
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    // Personal post-booking page — never in a search index.
    robots: { index: false, follow: false },
  }
}

export default async function ConfirmationPage({
  params,
  searchParams,
}: PageProps<"/[locale]/confirmation">) {
  const [{ locale }, query] = await Promise.all([params, searchParams])
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const id = singleParam(query.id) ?? null

  return (
    <main className="flex flex-1 flex-col">
      <Confirmation id={id} />
    </main>
  )
}
