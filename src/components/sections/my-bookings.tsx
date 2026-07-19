import { getLocale, getTranslations } from "next-intl/server"

import { BookingsContent } from "@/components/sections/bookings-content"
import { Container, Section } from "@/components/layout/container"
import { PageHeader } from "@/components/ui/page-header"
import { TintedCard } from "@/components/ui/tinted-card"
import { BodySm } from "@/components/ui/typography"
import {
  BOOKING_DISPLAY_COLUMNS,
  toDisplayBookings,
  type DisplayBooking,
} from "@/lib/booking-display"
import { isActiveBookingStatus } from "@/lib/booking-status"
import { createAuthedSupabaseServerClient } from "@/lib/supabase/server"

/**
 * MyBookings — the signed-in client's appointment list. The proxy guarantees
 * a session; RLS scopes the rows (self-booked and studio-created alike).
 * Owns the data; all rendering states live in BookingsContent.
 */
export async function MyBookings({ notice = null }: { notice?: string | null }) {
  const [t, locale] = await Promise.all([
    getTranslations("bookings"),
    getLocale(),
  ])

  const supabase = createAuthedSupabaseServerClient()
  const { data: rows, error } = await supabase
    .from("bookings")
    .select(BOOKING_DISPLAY_COLUMNS)
    .order("start_time", { ascending: false })

  if (error) {
    console.error("[my-bookings] read failed", error.message)
  }

  // Shared resolver: one catalog query for all names, degrading to the generic
  // session label on failure rather than failing the page.
  const display = await toDisplayBookings(
    supabase,
    rows ?? [],
    locale,
    "my-bookings",
  )

  // Request time — the one "now" for the split, policy, and countdowns.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  // A session counts as upcoming until it ENDS — in-progress bookings must
  // not show up in history as "completed".
  const isUpcoming = (b: DisplayBooking) =>
    new Date(b.row.end_time).getTime() > now &&
    isActiveBookingStatus(b.row.status)
  const upcoming = display
    .filter(isUpcoming)
    .sort(
      (a, b) =>
        new Date(a.row.start_time).getTime() -
        new Date(b.row.start_time).getTime(),
    )
  const past = display.filter((b) => !isUpcoming(b))

  return (
    <Section>
      <Container className="max-w-4xl">
        <PageHeader
          eyebrow={t("eyebrow")}
          lead={t("headingLine1")}
          muted={t("headingLine2")}
          intro={t("intro")}
        />
        {/* e.g. bounced off an ineligible reschedule — say why. */}
        {notice === "policy" ? (
          <TintedCard className="mb-10">
            <BodySm>{t("noticePolicy")}</BodySm>
          </TintedCard>
        ) : null}
        <BookingsContent
          failed={Boolean(error)}
          upcoming={upcoming}
          past={past}
          now={now}
        />
      </Container>
    </Section>
  )
}
