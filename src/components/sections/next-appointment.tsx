"use client"

import * as React from "react"
import { useUser } from "@clerk/nextjs"
import { useQuery } from "@tanstack/react-query"
import { useLocale, useTranslations } from "next-intl"
import type { SupabaseClient } from "@supabase/supabase-js"

import { Container, Section } from "@/components/layout/container"
import { ArrowLink } from "@/components/ui/arrow-link"
import { PriceTag } from "@/components/ui/price-tag"
import { SectionHeading } from "@/components/ui/section-heading"
import { TintedCard } from "@/components/ui/tinted-card"
import { Caption, H3 } from "@/components/ui/typography"
import {
  BOOKING_DISPLAY_COLUMNS,
  fetchBookingCatalog,
  metaOf,
  toDisplayBooking,
  type DisplayBooking,
} from "@/lib/booking-display"
import { ACTIVE_BOOKING_STATUSES } from "@/lib/booking-status"
import {
  formatCountdown,
  formatStudioDate,
  formatStudioTime,
} from "@/lib/studio-time"
import { useSupabaseBrowserClient } from "@/lib/supabase/client"
import type { Database } from "@/lib/supabase/types"
import { routes } from "@/config/routes"

/** Soonest active booking that hasn't ENDED yet (in-progress still counts),
    resolved to display data via the shared booking catalog. Null when
    nothing is booked. */
async function fetchNextAppointment(
  supabase: SupabaseClient<Database>,
  locale: string,
): Promise<DisplayBooking | null> {
  const { data: row, error } = await supabase
    .from("bookings")
    .select(BOOKING_DISPLAY_COLUMNS)
    .in("status", [...ACTIVE_BOOKING_STATUSES])
    .gt("end_time", new Date().toISOString())
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!row) return null

  const catalog = await fetchBookingCatalog(supabase, [metaOf(row).serviceId])
  return toDisplayBooking(row, catalog, locale)
}

/** Wall-clock that ticks once a minute so the countdown stays honest in a
    tab left open. */
function useMinuteNow(): number {
  // eslint-disable-next-line react-hooks/purity -- clock read; ticks below
  const [now, setNow] = React.useState(Date.now())
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])
  return now
}

/**
 * NextAppointment — the signed-in client's personal band on the home page.
 * Client component so the page stays static: signed-out visitors and clients
 * with nothing booked render nothing at all.
 */
export function NextAppointment() {
  const { user } = useUser()
  const supabase = useSupabaseBrowserClient()
  const t = useTranslations("bookings")
  const locale = useLocale()
  const now = useMinuteNow()

  const { data: next } = useQuery({
    queryKey: ["next-appointment", user?.id, locale],
    queryFn: () => fetchNextAppointment(supabase, locale),
    enabled: Boolean(user),
  })

  if (!user || !next) return null

  return (
    // Section-level divider (same device as FindUs) between this personal
    // band and the marketing sections below.
    <Section className="border-b border-border">
      <Container className="max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow={t("nextEyebrow")}
            lead={t("nextHeadingLead")}
            accent={t("nextHeadingAccent")}
            accentTone="secondary"
          />
          <ArrowLink href={routes.appointments}>{t("nextCta")}</ArrowLink>
        </div>

        <TintedCard className="mt-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <H3>{next.serviceName ?? t("sessionFallback")}</H3>
              <Caption className="block text-xs tracking-wide normal-case">
                {formatStudioDate(next.row.start_time, locale)} ·{" "}
                {formatStudioTime(next.row.start_time, locale)}–
                {formatStudioTime(next.row.end_time, locale)}
              </Caption>
            </div>
            <div className="flex flex-col gap-2 md:items-end">
              <Caption className="text-[10px] tracking-widest-lux">
                {formatCountdown(next.row.start_time, locale, now)}
              </Caption>
              <PriceTag cents={next.row.total_price_cents} className="text-lg" />
            </div>
          </div>
        </TintedCard>
      </Container>
    </Section>
  )
}
