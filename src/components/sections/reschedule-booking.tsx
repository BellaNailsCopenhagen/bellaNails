import { getLocale, getTranslations } from "next-intl/server"

import { Container, Section } from "@/components/layout/container"
import { RescheduleEmbed } from "@/components/sections/reschedule-embed"
import { ArrowLink } from "@/components/ui/arrow-link"
import { PageHeader } from "@/components/ui/page-header"
import { BodySm } from "@/components/ui/typography"
import { formatStudioDate, formatStudioTime } from "@/lib/studio-time"
import { routes } from "@/config/routes"

/** RescheduleBooking — back link, editorial header, the current slot, and
    Cal's inline reschedule view. Eligibility is the page's job. */
export async function RescheduleBooking({
  uid,
  startTime,
}: {
  uid: string
  startTime: string
}) {
  const [t, locale] = await Promise.all([
    getTranslations("bookings"),
    getLocale(),
  ])

  return (
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
          {t("rescheduleCurrent")}: {formatStudioDate(startTime, locale)} ·{" "}
          {formatStudioTime(startTime, locale)}
        </BodySm>
        <RescheduleEmbed uid={uid} />
      </Container>
    </Section>
  )
}
