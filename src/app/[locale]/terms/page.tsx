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
  return legalMetadata(locale, "service")
}

/** Public booking / service terms — the current `service` version. */
export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  return <LegalPage locale={locale} kind="service" />
}
