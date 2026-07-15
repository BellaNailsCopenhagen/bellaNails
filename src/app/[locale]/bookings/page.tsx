import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { MyBookings } from "@/components/sections/my-bookings"
import { routing } from "@/i18n/routing"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  const t = await getTranslations({ locale, namespace: "bookings" })
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    // Personal account page — never in a search index.
    robots: { index: false, follow: false },
  }
}

/** Auth gate lives in the proxy (`/bookings` is a protected route): a
    signed-out visit redirects to the localized sign-in and returns here. */
export default async function BookingsPage({
  params,
}: PageProps<"/[locale]/bookings">) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  return (
    <main className="flex flex-1 flex-col">
      <MyBookings />
    </main>
  )
}
