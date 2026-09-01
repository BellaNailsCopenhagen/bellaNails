import { getLocale, getTranslations } from "next-intl/server"

import { Container, Section } from "@/components/layout/container"
import { RescheduleSlotStep } from "@/app/[locale]/appointments/reschedule/[id]/_components/reschedule-slot-step"
import { ArrowLink } from "@/components/ui/arrow-link"
import { PageHeader } from "@/components/ui/page-header"
import { BodySm } from "@/components/ui/typography"
import { getMaxAdvanceDays } from "@/modules/booking"
import { getSlotsForDuration } from "@/modules/booking"
import { formatStudioDate, formatStudioTime } from "@/shared/studio-time"
import { routes } from "@/config/routes"

/** RescheduleBooking — back link, editorial header, the current slot, and the
    in-house time picker. Eligibility is the page's job; availability is sized by
    the booking's as-booked footprint, passed in. */
export async function RescheduleBooking({
  id,
  startTime,
  durationMins,
}: {
  id: string
  startTime: string
  /** The as-booked footprint — resolved by the page, never derived here. */
  durationMins: number
}) {
  const [t, locale, slots, maxAdvanceDays] = await Promise.all([
    getTranslations("bookings"),
    getLocale(),
    durationMins > 0 ? getSlotsForDuration(durationMins) : Promise.resolve([]),
    getMaxAdvanceDays(),
  ])

  return (
    <Section>
      <Container className="max-w-4xl">
        <div className="pb-8">
          <ArrowLink back href={routes.appointments}>
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
        <RescheduleSlotStep
          id={id}
          slots={slots}
          maxAdvanceDays={maxAdvanceDays}
        />
      </Container>
    </Section>
  )
}
