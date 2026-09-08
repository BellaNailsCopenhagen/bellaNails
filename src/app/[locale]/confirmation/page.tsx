import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { Confirmation } from "@/app/[locale]/confirmation/_components/confirmation"
import { routing } from "@/i18n/routing"
import { singleParam } from "@/shared/search-params"

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/[locale]/confirmation">): Promise<Metadata> {
  const [{ locale }, query] = await Promise.all([params, searchParams])
  if (!hasLocale(routing.locales, locale)) notFound()
  const t = await getTranslations({ locale, namespace: "confirmation" })
  // The tab title is part of the claim: without an id nothing is confirmed.
  const confirmed = singleParam(query.id) != null
  return {
    title: confirmed ? t("metaTitle") : t("missingMetaTitle"),
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
