import { getLocale, getTranslations } from "next-intl/server"

import { getCurrentUser } from "@/lib/identity/server"

import { BookingsContent } from "@/components/sections/bookings-content"
import { TintedCard } from "@/components/ui/tinted-card"
import { BodySm } from "@/components/ui/typography"
import {
  BOOKING_DISPLAY_COLUMNS,
  toDisplayBookings,
  type DisplayBooking,
} from "@/lib/booking-display"
import { isActiveBookingStatus } from "@/shared/booking-status"
import type { ClientMediaItem } from "@/lib/media"
import { createAuthedSupabaseServerClient } from "@/platform/supabase/server"

/**
 * MyBookings — the signed-in client's appointment list. The proxy guarantees
 * a session; RLS scopes the rows (self-booked and studio-created alike).
 * Owns the data; all rendering states live in BookingsContent. `media` is
 * fetched once by the page and passed in (the consent centre needs it too).
 */
export async function MyBookings({
  notice = null,
  media = [],
}: {
  notice?: string | null
  media?: ClientMediaItem[]
}) {
  const [t, locale, user] = await Promise.all([
    getTranslations("bookings"),
    getLocale(),
    getCurrentUser(),
  ])

  // Personal surface: always the signed-in user's OWN bookings, even for the
  // owner (whose owner-reads-all RLS would otherwise surface the whole studio
  // here — that view belongs to /admin). Explicit filter, not RLS-scoped.
  const supabase = await createAuthedSupabaseServerClient()
  const { data: rows, error } = await supabase
    .from("bookings")
    .select(BOOKING_DISPLAY_COLUMNS)
    .eq("client_id", user?.id ?? "")
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

  // The client's own photos, grouped by booking (passed from the page).
  const photosByBooking: Record<string, ClientMediaItem[]> = {}
  for (const item of media) {
    if (!item.bookingId) continue
    ;(photosByBooking[item.bookingId] ??= []).push(item)
  }

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
    <>
      {/* e.g. bounced off an ineligible reschedule — say why. */}
      {notice === "policy" ? (
        <TintedCard className="mb-8">
          <BodySm>{t("noticePolicy")}</BodySm>
        </TintedCard>
      ) : null}
      <BookingsContent
        failed={Boolean(error)}
        upcoming={upcoming}
        past={past}
        now={now}
        photosByBooking={photosByBooking}
      />
    </>
  )
}
