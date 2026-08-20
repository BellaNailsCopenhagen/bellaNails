import { notFound } from "next/navigation"
import { hasLocale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import { routing } from "@/i18n/routing"
import { Hero } from "@/app/[locale]/_components/hero"
import { RequestsBanner } from "@/app/[locale]/_components/requests-banner"
import { NextAppointment } from "@/app/[locale]/_components/next-appointment"
import { ServicesPreview } from "@/app/[locale]/_components/services-preview"
import { Formula } from "@/app/[locale]/_components/formula"
import { Differentiators } from "@/app/[locale]/_components/differentiators"
import { StudioGallery } from "@/components/gallery/studio-gallery"
import { Showcase } from "@/app/[locale]/_components/showcase"
import { Testimonials } from "@/app/[locale]/_components/testimonials"
import { FindUs } from "@/app/[locale]/_components/find-us"

export default async function Home({
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
      {/* Signed-in clients with pending consent requests get a banner here;
          everyone else renders nothing (client-side, so the page stays static). */}
      <RequestsBanner />
      <Hero />
      {/* Signed-in clients with an upcoming booking get their personal
          band here; everyone else renders nothing (client-side, so the
          page stays static). */}
      <NextAppointment />
      <ServicesPreview />
      <Formula />
      <Differentiators />
      <StudioGallery />
      {/* Recent consented client work; renders nothing until a photo is placed. */}
      <Showcase />
      <Testimonials />
      <FindUs />
    </main>
  )
}
