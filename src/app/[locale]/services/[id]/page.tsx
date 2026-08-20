import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { routing } from "@/i18n/routing"
import { Container, Section } from "@/components/layout/container"
import { PageHeader } from "@/components/ui/page-header"
import { PriceTag } from "@/components/ui/price-tag"
import { Eyebrow } from "@/components/ui/typography"
import { ClientWorkGrid } from "@/components/sections/client-work-grid"
import { FloatingBookButton } from "@/components/sections/floating-book-button"
import { createSupabaseServerClient } from "@/platform/supabase/server"
import {
  getPublicService,
  getServicePublicGallery,
} from "@/lib/services/get-public-service"
import { getServiceSections } from "@/lib/service-sections"
import { getServiceReviews } from "@/lib/reviews"
import { pickLocalized } from "@/lib/i18n/localized"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}): Promise<Metadata> {
  const { locale, id } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  const service = await getPublicService(id)
  if (!service) return {}
  const name = pickLocalized(locale, service.nameEn, service.nameDk)
  return { title: name ?? service.nameEn }
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const supabase = createSupabaseServerClient()
  const [t, service] = await Promise.all([
    getTranslations("serviceDetail"),
    getPublicService(id, supabase),
  ])
  if (!service) notFound()

  const [sections, gallery, reviews] = await Promise.all([
    getServiceSections(supabase, id),
    getServicePublicGallery(id, supabase),
    getServiceReviews(id, supabase),
  ])

  const name = pickLocalized(locale, service.nameEn, service.nameDk) ?? service.nameEn
  const description = pickLocalized(
    locale,
    service.descriptionEn,
    service.descriptionDk,
  )

  return (
    <main className="flex flex-1 flex-col pb-24">
      <Section className="pb-0">
        <Container className="max-w-3xl space-y-4">
          <PageHeader eyebrow={t("eyebrow")} lead={name} intro={description ?? undefined} />
          <div className="flex items-baseline gap-4">
            <PriceTag cents={service.basePriceCents} className="text-2xl" />
            <span className="font-functional text-sm text-muted-foreground">
              {service.baseDurationMins} {t("minutes")}
            </span>
          </div>
        </Container>
      </Section>

      {sections.length ? (
        <Section className="pt-10">
          <Container className="max-w-3xl space-y-14">
            {sections.map((section) => {
              const title = pickLocalized(locale, section.titleEn, section.titleDk)
              const body = pickLocalized(locale, section.bodyEn, section.bodyDk)
              return (
                <article key={section.id} className="space-y-4">
                  {section.imageUrl ? (
                    /* Hidden on mobile — text-first keeps small screens clean. */
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={section.imageUrl}
                      alt={title ?? ""}
                      loading="lazy"
                      className="hidden w-full rounded-sm border border-border sm:block"
                    />
                  ) : null}
                  {title ? (
                    <h2 className="font-editorial text-2xl text-foreground">
                      {title}
                    </h2>
                  ) : null}
                  {body ? (
                    <p className="whitespace-pre-line font-functional text-sm leading-relaxed text-muted-foreground">
                      {body}
                    </p>
                  ) : null}
                </article>
              )
            })}
          </Container>
        </Section>
      ) : null}

      {gallery.studio.length ? (
        <Section className="border-t border-border">
          <Container className="max-w-4xl space-y-6">
            <Eyebrow as="h2">{t("byStudio")}</Eyebrow>
            <ClientWorkGrid assets={gallery.studio} alt={t("galleryAlt")} />
          </Container>
        </Section>
      ) : null}

      {reviews.length || gallery.clients.length ? (
        <Section className="border-t border-border">
          <Container className="max-w-4xl space-y-6">
            <Eyebrow as="h2">{t("fromClients")}</Eyebrow>
            {reviews.length ? (
              <ul className="grid gap-6 sm:grid-cols-2">
                {reviews.map((review) => (
                  <li key={review.id}>
                    <figure className="space-y-2">
                      <blockquote className="font-editorial text-lg leading-snug text-foreground text-pretty">
                        “{review.body}”
                      </blockquote>
                      {review.authorName ? (
                        <figcaption className="font-functional text-xs uppercase tracking-widest-lux text-muted-foreground">
                          {review.authorName}
                        </figcaption>
                      ) : null}
                    </figure>
                  </li>
                ))}
              </ul>
            ) : null}
            {gallery.clients.length ? (
              <ClientWorkGrid assets={gallery.clients} alt={t("galleryAlt")} />
            ) : null}
          </Container>
        </Section>
      ) : null}

      <FloatingBookButton serviceId={service.id} label={t("book")} />
    </main>
  )
}
