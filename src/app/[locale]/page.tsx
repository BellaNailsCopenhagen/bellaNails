import { notFound } from "next/navigation"
import { hasLocale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import { routing } from "@/i18n/routing"
import { Hero } from "@/components/sections/hero"
import { RequestsBanner } from "@/components/sections/requests-banner"
import { NextAppointment } from "@/components/sections/next-appointment"
import { ServicesPreview } from "@/components/sections/services-preview"
import { Formula } from "@/components/sections/formula"
import { Differentiators } from "@/components/sections/differentiators"
import { StudioGallery } from "@/components/sections/studio-gallery"
import { Showcase } from "@/components/sections/showcase"
import { Testimonials } from "@/components/sections/testimonials"
import { FindUs } from "@/components/sections/find-us"

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
