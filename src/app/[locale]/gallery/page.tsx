import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { GalleryPreview } from "@/app/[locale]/gallery/_components/gallery-preview"
import { routing } from "@/i18n/routing"
import { alternatesFor } from "@/config/site"
import { routes } from "@/config/routes"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  const t = await getTranslations({ locale, namespace: "gallery" })
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: alternatesFor(locale, routes.gallery),
  }
}

/** Placeholder until the curated portfolio ships (PLAN Phase 7) — reuses
    the DB-backed studio imagery so the nav link stops 404ing. */
export default async function GalleryPage({
  params,
}: PageProps<"/[locale]/gallery">) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  return (
    <main className="flex flex-1 flex-col">
      <GalleryPreview />
    </main>
  )
}
