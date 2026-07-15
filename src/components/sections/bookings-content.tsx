import { useTranslations } from "next-intl"

import { Link } from "@/i18n/navigation"
import { BookingsEmptyState } from "@/components/sections/bookings-empty-state"
import { BookingsPastRow } from "@/components/sections/bookings-past-row"
import { BookingsUpcomingCard } from "@/components/sections/bookings-upcoming-card"
import { ArrowLink } from "@/components/ui/arrow-link"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { BodySm, Eyebrow } from "@/components/ui/typography"
import type { DisplayBooking } from "@/lib/booking-display"
import { routes } from "@/config/routes"

/** One guard-clause return per page state: load failure, nothing booked
    yet, or the upcoming/history sections. */
function BookingsContent({
  failed,
  upcoming,
  past,
  now,
}: {
  failed: boolean
  upcoming: DisplayBooking[]
  past: DisplayBooking[]
  now: number
}) {
  const t = useTranslations("bookings")

  if (failed) {
    return <BodySm>{t("loadError")}</BodySm>
  }

  if (upcoming.length === 0 && past.length === 0) {
    return (
      <BookingsEmptyState>
        <ArrowLink href={routes.services}>{t("emptyCta")}</ArrowLink>
      </BookingsEmptyState>
    )
  }

  return (
    <div className="space-y-16">
      <UpcomingSection bookings={upcoming} now={now} />
      <PastSection bookings={past} />
    </div>
  )
}

function UpcomingSection({
  bookings,
  now,
}: {
  bookings: DisplayBooking[]
  now: number
}) {
  const t = useTranslations("bookings")

  if (bookings.length === 0) {
    // Distinct copy from the zero-bookings state: this renders above a
    // populated History, so "no appointments yet" would be false.
    return (
      <div className="space-y-6">
        <Eyebrow>{t("upcoming")}</Eyebrow>
        <EmptyState title={t("noUpcomingTitle")} body={t("noUpcomingBody")}>
          <Button nativeButton={false} render={<Link href={routes.book} />}>
            {t("emptyCtaBook")}
          </Button>
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Eyebrow>{t("upcoming")}</Eyebrow>
      <ul className="space-y-6">
        {bookings.map((booking) => (
          <BookingsUpcomingCard
            key={booking.row.cal_booking_id}
            booking={booking}
            now={now}
          />
        ))}
      </ul>
    </div>
  )
}

function PastSection({ bookings }: { bookings: DisplayBooking[] }) {
  const t = useTranslations("bookings")

  if (bookings.length === 0) return null

  return (
    <div className="space-y-2">
      <Eyebrow>{t("past")}</Eyebrow>
      <ul>
        {bookings.map((booking) => (
          <BookingsPastRow key={booking.row.cal_booking_id} booking={booking} />
        ))}
      </ul>
    </div>
  )
}

export { BookingsContent }
