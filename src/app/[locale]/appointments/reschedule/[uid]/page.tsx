import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { redirect } from "@/i18n/navigation"
import { routing } from "@/i18n/routing"
import { RescheduleBooking } from "@/app/[locale]/appointments/reschedule/[uid]/_components/reschedule-booking"
import {
  canManageBooking,
} from "@/shared/booking-policy"
import { routes } from "@/config/routes"
import { getMyBookingLifecycle } from "@/modules/booking"

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
    description: t("rescheduleMetaDescription"),
    // Personal page — never in a search index.
    robots: { index: false, follow: false },
  }
}

/** Auth gate lives in the proxy; the RLS read proves ownership (someone
    else's uid reads as missing → 404). Ineligible bookings bounce back to
    /bookings with a notice. */
export default async function ReschedulePage({
  params,
}: PageProps<"/[locale]/appointments/reschedule/[uid]">) {
  const { locale, uid } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)

  const booking = await getMyBookingLifecycle(uid)
  if (!booking) notFound()

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
      <RescheduleBooking uid={uid} startTime={booking.start_time} />
    </main>
  )
}
