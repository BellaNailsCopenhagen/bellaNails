import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { OfferBooking } from "@/app/[locale]/offer/[token]/_components/offer-booking"
import { Container, Section } from "@/components/layout/container"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { PriceTag } from "@/components/ui/price-tag"
import { BodySm, Eyebrow } from "@/components/ui/typography"
import { getMaxAdvanceDays, getSlotsForDuration } from "@/modules/booking"
import { getOfferByToken } from "@/modules/design"
import { pickLocalized } from "@/shared/localized"
import { formatStudioDayMonthYear } from "@/shared/studio-time"
import { routes } from "@/config/routes"
import { routing } from "@/i18n/routing"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }
  const t = await getTranslations({ locale, namespace: "offer" })

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    // One person's private offer — never indexed.
    robots: { index: false, follow: false },
  }
}

/**
 * One client's offer, reached by its signed link. The token IS the
 * authorization — there is no catalog row behind this, so nothing to
 * over-permission. A withdrawn, used or expired offer still renders, with an
 * explanation and a way back to Bella, rather than a dead 404.
 */
export default async function OfferPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>
}) {
  const { locale, token } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }
  setRequestLocale(locale)

  const t = await getTranslations({ locale, namespace: "offer" })
  const offer = await getOfferByToken(token)

  if (!offer) {
    return (
      <OfferShell eyebrow={t("eyebrow")} lead={t("notFoundTitle")}>
        <BodySm>{t("notFoundBody")}</BodySm>
        <AskButton label={t("blockedCta")} />
      </OfferShell>
    )
  }

  const name = pickLocalized(locale, offer.nameEn, offer.nameDk) ?? offer.nameEn

  if (offer.state !== "live") {
    return (
      <OfferShell eyebrow={t("eyebrow")} lead={name}>
        <BodySm>{t(`blocked.${offer.state}`)}</BodySm>
        <AskButton label={t("blockedCta")} />
      </OfferShell>
    )
  }

  const [slots, maxAdvanceDays] = await Promise.all([
    getSlotsForDuration(offer.durationMins),
    getMaxAdvanceDays(),
  ])

  return (
    <Section>
      <Container className="max-w-4xl space-y-10">
        <PageHeader eyebrow={t("eyebrow")} lead={name} />

        <div className="space-y-5 border border-border bg-card p-6">
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
            <BodySm className="text-base text-foreground">
              {t("duration", { mins: offer.durationMins })}
            </BodySm>
            <PriceTag cents={offer.priceCents} className="text-base" />
          </div>

          {offer.artistNote ? (
            <blockquote className="border-l-2 border-border pl-4 font-editorial text-lg leading-snug text-foreground">
              {offer.artistNote}
            </blockquote>
          ) : null}

          {offer.refs.length ? (
            <div className="space-y-2">
              <Eyebrow>{t("yourPhotos")}</Eyebrow>
              <ul className="flex flex-wrap gap-2">
                {offer.refs.map((ref) => (
                  <li key={ref.id}>
                    {/* Private object behind a short-lived signed URL — not
                        eligible for the image optimizer. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ref.url}
                      alt={t("photoAlt")}
                      className="size-20 rounded-sm border border-border object-cover"
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <BodySm className="text-xs text-muted-foreground">
            {t("holdsUntil", {
              date: formatStudioDayMonthYear(
                Date.parse(offer.expiresAt),
                locale,
              ),
            })}
          </BodySm>
        </div>

        <OfferBooking
          token={token}
          locale={locale}
          slots={slots}
          maxAdvanceDays={maxAdvanceDays}
        />
      </Container>
    </Section>
  )
}

function OfferShell({
  eyebrow,
  lead,
  children,
}: {
  eyebrow: string
  lead: string
  children: React.ReactNode
}) {
  return (
    <Section>
      <Container className="max-w-4xl space-y-6">
        <PageHeader eyebrow={eyebrow} lead={lead} />
        {children}
      </Container>
    </Section>
  )
}

function AskButton({ label }: { label: string }) {
  return (
    <div>
      <Button nativeButton={false} render={<Link href={routes.ask} />}>
        {label}
      </Button>
    </div>
  )
}
