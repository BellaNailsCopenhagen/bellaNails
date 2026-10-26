import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { routing } from "@/i18n/routing"
import { Container, Section } from "@/components/layout/container"
import { PageHeader } from "@/components/ui/page-header"
import { BodySm } from "@/components/ui/typography"
import { ManageBooking } from "@/app/[locale]/manage/[token]/_components/manage-booking"
import {
  getSlotsForDuration,
  getBookingForSignedToken,
  getMaxAdvanceDays,
  verifyBookingToken,
} from "@/modules/booking"
import { bookedDurationMins, canManageBooking } from "@/shared/booking-policy"
import { formatStudioDate, formatStudioTime } from "@/shared/studio-time"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }
  const t = await getTranslations({ locale, namespace: "bookings" })

  // A tokenized personal link — never in a search index.
  return {
    title: t("manageMetaTitle"),
    robots: { index: false, follow: false },
  }
}

export const dynamic = "force-dynamic"

/**
 * Guest self-service manage page (no account). The signed token from the email
 * link IS the authorization — verified here and again in each action. The
 * booking is read with service-role; the 24 h policy decides whether the page
 * offers reschedule/cancel or points the guest at the studio.
 */
export default async function ManagePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>
}) {
  const { locale, token } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }
  setRequestLocale(locale)

  const id = verifyBookingToken(token)
  if (!id) {
    notFound()
  }

  const booking = await getBookingForSignedToken(id)
  if (!booking) {
    notFound()
  }

  const [t, maxAdvanceDays] = await Promise.all([
    getTranslations({ locale, namespace: "bookings" }),
    getMaxAdvanceDays(),
  ])

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  const manageable = canManageBooking(booking, now)
  // Sized from the as-booked footprint, so an offer booking (no catalog
  // service) is reschedulable too.
  const slots = manageable
    ? await getSlotsForDuration(bookedDurationMins(booking))
    : []

  return (
    <Section>
      <Container className="max-w-4xl">
        <PageHeader
          eyebrow={t("eyebrow")}
          lead={t("manageHeading1")}
          muted={t("manageHeading2")}
          intro={t("manageIntro")}
        />
        <BodySm className="pb-8">
          {t("rescheduleCurrent")}:{" "}
          {formatStudioDate(booking.start_time, locale)} ·{" "}
          {formatStudioTime(booking.start_time, locale)}
        </BodySm>
        <ManageBooking
          token={token}
          manageable={manageable}
          slots={slots}
          maxAdvanceDays={maxAdvanceDays}
        />
      </Container>
    </Section>
  )
}
