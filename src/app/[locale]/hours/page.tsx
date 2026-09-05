import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { hasLocale } from "next-intl"
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { routing } from "@/i18n/routing"
import { OpeningHours } from "@/app/[locale]/_components/opening-hours"
import { Container, Section } from "@/components/layout/container"
import { ArrowLink } from "@/components/ui/arrow-link"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { TintedCard } from "@/components/ui/tinted-card"
import { BodySm, Eyebrow, H3 } from "@/components/ui/typography"
import { getBusinessProfile } from "@/modules/business/profile"
import { getSchedule } from "@/modules/studio"
import { hasOpeningHours, upcomingExceptions } from "@/shared/opening-hours"
import { mapsUrlFor, oneLineAddress } from "@/shared/business-profile"
import { dayNumberForIso } from "@/shared/studio-hours"
import {
  dayNumberToMs,
  formatStudioDayMonth,
  studioDayNumber,
} from "@/shared/studio-time"
import { routes } from "@/config/routes"

/** How far ahead a one-off closure is worth announcing. Beyond a season it is
    planning, not information. */
const EXCEPTION_HORIZON_DAYS = 120

/**
 * Regenerate hourly.
 *
 * This page is prerendered, and it reads the clock to decide which closures are
 * still ahead — so without this the window would be frozen at BUILD time: last
 * month's closure would still read as upcoming, and one added for next spring
 * would never appear. A schedule edit revalidates it too; this is the floor for
 * when nobody edits anything for a season.
 */
export const revalidate = 3600

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  const t = await getTranslations({ locale, namespace: "hours" })
  return { title: t("metaTitle"), description: t("metaDescription") }
}

/**
 * Opening hours — the weekly pattern, the days that break it, and a plain
 * warning that neither is a list of free times.
 *
 * It exists because the home page's Find-us section is the wrong shape for
 * this: a by-appointment studio open two days a week rendered five rows of
 * "Closed" there. Here the same data has room to say what it means.
 */
export default async function HoursPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale: requested } = await params
  if (!hasLocale(routing.locales, requested)) notFound()
  setRequestLocale(requested)

  const [t, locale, schedule, profile] = await Promise.all([
    getTranslations("hours"),
    getLocale(),
    getSchedule(),
    getBusinessProfile(),
  ])

  // Render-time clock read; `revalidate` above is what keeps it from staling.
  // eslint-disable-next-line react-hooks/purity
  const today = studioDayNumber(Date.now())
  const exceptions = upcomingExceptions(schedule, today, EXCEPTION_HORIZON_DAYS)
  const address = oneLineAddress(profile)
  const mapsUrl = mapsUrlFor(profile)

  return (
    <main className="flex flex-1 flex-col">
      <Section>
        <Container className="max-w-4xl space-y-12">
          <PageHeader
            eyebrow={t("eyebrow")}
            lead={t("headingLead")}
            muted={t("headingAccent")}
            intro={t("intro")}
          />

          {hasOpeningHours(schedule) ? (
            <div className="space-y-3 border-t border-border pt-8">
              <Eyebrow as="h2">{t("thisWeek")}</Eyebrow>
              <OpeningHours
                schedule={schedule}
                locale={locale}
                closedLabel={t("closed")}
                className="max-w-xs text-sm text-foreground"
              />
            </div>
          ) : (
            <div className="space-y-2 border-t border-border pt-8">
              <H3>{t("emptyTitle")}</H3>
              <BodySm>{t("emptyBody")}</BodySm>
            </div>
          )}

          {/* One-off closures and extra days. "Nothing coming up" is worth
              saying out loud — silence here reads as a page nobody maintains. */}
          <div className="space-y-3">
            <Eyebrow as="h2">{t("exceptionsTitle")}</Eyebrow>
            {exceptions.length ? (
              <ul className="space-y-2">
                {exceptions.map((exception) => (
                  <li
                    key={exception.onDate}
                    className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-border pb-2 font-functional text-sm last:border-b-0"
                  >
                    <span className="min-w-24 text-foreground">
                      {formatStudioDayMonth(
                        dayNumberToMs(dayNumberForIso(exception.onDate)),
                        locale,
                      )}
                    </span>
                    <span className="text-foreground">
                      {exception.closedAllDay
                        ? t("exceptionsClosed")
                        : exception.ranges
                            .map(([start, end]) => `${start} – ${end}`)
                            .join(", ")}
                    </span>
                    {exception.label ? (
                      <span className="text-muted-foreground">
                        {exception.label}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <BodySm>{t("exceptionsNone")}</BodySm>
            )}
          </div>

          {/* The point of the page: hours are not availability. */}
          <TintedCard className="space-y-2">
            <H3>{t("warningTitle")}</H3>
            <BodySm>{t("warningBody")}</BodySm>
          </TintedCard>

          {address ? (
            <div className="space-y-2 border-t border-border pt-8">
              <Eyebrow as="h2">{t("whereLabel")}</Eyebrow>
              <BodySm className="text-foreground">{address}</BodySm>
              {mapsUrl ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block font-functional text-xs uppercase tracking-widest-lux text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  {t("openMaps")}
                </a>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-6">
            <Button nativeButton={false} render={<Link href={routes.book} />}>
              {t("bookCta")}
            </Button>
            <ArrowLink href={routes.ask}>{t("askCta")}</ArrowLink>
          </div>
        </Container>
      </Section>
    </main>
  )
}
