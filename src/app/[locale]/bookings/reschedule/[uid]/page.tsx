import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { hasLocale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { redirect } from "@/i18n/navigation"
import { routing } from "@/i18n/routing"
import { RescheduleBooking } from "@/components/sections/reschedule-booking"
import { canManageBooking } from "@/lib/booking-display"
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

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  if (!canManageBooking(booking, now)) {
    redirect({
      href: { pathname: routes.bookings, query: { notice: "policy" } },
      locale,
    })
  }

  return (
    <main className="flex flex-1 flex-col">
      <RescheduleBooking uid={uid} startTime={booking.start_time} />
    </main>
  )
}
