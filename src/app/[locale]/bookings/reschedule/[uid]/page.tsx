import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { redirect } from "@/i18n/navigation"
import { routing } from "@/i18n/routing"
import { Container, Section } from "@/components/layout/container"
import { RescheduleEmbed } from "@/components/sections/reschedule-embed"
import { ArrowLink } from "@/components/ui/arrow-link"
import { PageHeader } from "@/components/ui/page-header"
import { BodySm } from "@/components/ui/typography"
import { POLICY_WINDOW_MS } from "@/lib/booking-display"
import { isActiveBookingStatus } from "@/lib/booking-status"
import { formatStudioDate, formatStudioTime } from "@/lib/studio-time"
import { createAuthedSupabaseServerClient } from "@/lib/supabase/server"
import { routes } from "@/config/routes"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  const t = await getTranslations({ locale, namespace: "bookings" })
  return {
    title: t("rescheduleMetaTitle"),
    robots: { index: false, follow: false },
  }
}

/** In-app reschedule: the proxy gates auth; the RLS read proves ownership
    (someone else's uid reads as missing → 404). Ineligible bookings
    (cancelled, past, within the 24 h policy) bounce back to /bookings. */
export default async function ReschedulePage({
  params,
}: PageProps<"/[locale]/bookings/reschedule/[uid]">) {
  const { locale, uid } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const supabase = createAuthedSupabaseServerClient()
  const { data: booking } = await supabase
    .from("bookings")
    .select("cal_uid, status, start_time")
    .eq("cal_uid", uid)
    .maybeSingle()
  if (!booking) notFound()

  const startMs = new Date(booking.start_time).getTime()
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  if (
    !isActiveBookingStatus(booking.status) ||
    startMs <= now ||
    startMs - now < POLICY_WINDOW_MS
  ) {
    redirect({ href: routes.bookings, locale })
  }

  const t = await getTranslations("bookings")

  return (
    <main className="flex flex-1 flex-col">
      <Section>
        <Container className="max-w-4xl">
          <div className="pb-8">
            <ArrowLink back href={routes.bookings}>
              {t("backToBookings")}
            </ArrowLink>
          </div>
          <PageHeader
            eyebrow={t("eyebrow")}
            lead={t("rescheduleHeading1")}
            muted={t("rescheduleHeading2")}
            intro={t("rescheduleIntro")}
          />
          <BodySm className="pb-8">
            {t("rescheduleCurrent")}:{" "}
            {formatStudioDate(booking.start_time, locale)} ·{" "}
            {formatStudioTime(booking.start_time, locale)}
          </BodySm>
          <RescheduleEmbed uid={uid} />
        </Container>
      </Section>
    </main>
  )
}
