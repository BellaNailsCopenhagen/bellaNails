import type { Metadata } from "next"

import { createAuthedSupabaseServerClient } from "@/platform/supabase/server"
import { ACTIVE_BOOKING_STATUSES } from "@/shared/booking-status"
import { BOOKING_DISPLAY_COLUMNS } from "@/lib/booking-display"
import { resolveAdminBookings } from "@/lib/admin/bookings"
import { getBookingMediaThumbs } from "@/lib/admin/booking-media"
import { groupIntoAgenda } from "@/lib/admin/agenda"
import { AdminQueue } from "@/components/admin/admin-queue"

export const metadata: Metadata = { title: "Queue" }

// Per-owner reads (session cookies) — declare dynamic so the build doesn't
// attempt a static prerender and log a spurious DYNAMIC_SERVER_USAGE notice.
export const dynamic = "force-dynamic"

/**
 * Admin queue (home) — the forward agenda across ALL clients (owner-reads-all
 * RLS). Fetches upcoming bookings, resolves display names, groups by week →
 * day, and hands the result to the client AdminQueue for collapse/expand.
 *
 * Increment 1: server-fetched + grouped. Realtime, the Agenda↔Calendar toggle,
 * owner cancel, and client contact land in later increments.
 */
export default async function AdminQueuePage() {
  // eslint-disable-next-line react-hooks/purity -- request-time clock read
  const now = Date.now()
  const supabase = await createAuthedSupabaseServerClient()

  // Upcoming = not yet ENDED, so an in-progress appointment stays in the queue
  // (matches the client list's isUpcoming). Grouping still keys off start_time.
  const { data: rows, error } = await supabase
    .from("bookings")
    .select(BOOKING_DISPLAY_COLUMNS)
    .in("status", [...ACTIVE_BOOKING_STATUSES])
    .gte("end_time", new Date(now).toISOString())
    .order("start_time", { ascending: true })

  if (error) console.error("[admin-queue] read failed", error.message)

  const [{ bookings, contacts, noShowCounts }, photosByBooking] =
    await Promise.all([
      resolveAdminBookings(supabase, rows ?? [], "admin-queue"),
      getBookingMediaThumbs(
        supabase,
        (rows ?? []).map((r) => r.id),
      ),
    ])
  const weeks = groupIntoAgenda(bookings, now)

  return (
    <AdminQueue
      weeks={weeks}
      contacts={contacts}
      noShowCounts={noShowCounts}
      now={now}
      photosByBooking={photosByBooking}
      loadError={Boolean(error)}
    />
  )
}
