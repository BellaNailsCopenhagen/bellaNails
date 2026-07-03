import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { Hero } from "@/components/sections/hero";
import { ServicesPreview } from "@/components/sections/services-preview";
import { Formula } from "@/components/sections/formula";
import { Differentiators } from "@/components/sections/differentiators";
import { StudioGallery } from "@/components/sections/studio-gallery";
import { Testimonials } from "@/components/sections/testimonials";

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

  return (
    <main className="flex flex-1 flex-col">
      <Hero />
      <ServicesPreview />
      <Formula />
      <Differentiators />
      <StudioGallery />
      <Testimonials />
    </main>
  );
}
