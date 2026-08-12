import type { Metadata } from "next"

import { LegalPage, legalMetadata } from "@/components/sections/legal-page"

// DB-backed; render on demand so an admin edit shows immediately.
export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return legalMetadata(locale, "data")
}

/** Public privacy / data-use notice — the current `data` version. */
export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  return <LegalPage locale={locale} kind="data" />
}
