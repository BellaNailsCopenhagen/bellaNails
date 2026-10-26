import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { redirect } from "@/i18n/navigation"
import { routing } from "@/i18n/routing"
import { RescheduleBooking } from "@/app/[locale]/appointments/reschedule/[id]/_components/reschedule-booking"
import { bookedDurationMins, canManageBooking } from "@/shared/booking-policy"
import { routes } from "@/config/routes"
import { getMyBookingForManage } from "@/modules/booking"

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

  return {
    title: t("rescheduleMetaTitle"),
    description: t("rescheduleMetaDescription"),
    // Personal page — never in a search index.
    robots: { index: false, follow: false },
  }
}

/** Auth gate lives in the proxy; the RLS read proves ownership (someone
    else's id reads as missing → 404). Ineligible bookings bounce back to
    /appointments with a notice. */
export default async function ReschedulePage({
  params,
}: PageProps<"/[locale]/appointments/reschedule/[id]">) {
  const { locale, id } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }
  setRequestLocale(locale)

  const booking = await getMyBookingForManage(id)
  if (!booking) {
    notFound()
  }

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  if (!canManageBooking(booking, now)) {
    redirect({
      href: { pathname: routes.appointments, query: { notice: "policy" } },
      locale,
    })
  }

  return (
    <main className="flex flex-1 flex-col">
      <RescheduleBooking
        id={id}
        startTime={booking.start_time}
        durationMins={bookedDurationMins(booking)}
      />
    </main>
  )
}
