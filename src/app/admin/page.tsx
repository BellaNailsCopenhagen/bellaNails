import type { Metadata } from "next"
import Link from "next/link"
import { Bell } from "lucide-react"

import { createAuthedSupabaseServerClient } from "@/lib/supabase/server"
import { ACTIVE_BOOKING_STATUSES } from "@/lib/booking-status"
import { BOOKING_DISPLAY_COLUMNS } from "@/lib/booking-display"
import { resolveAdminBookings } from "@/lib/admin/bookings"
import { getUnreadNotificationCount } from "@/lib/admin/notifications"
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
  const supabase = createAuthedSupabaseServerClient()

  // Upcoming = not yet ENDED, so an in-progress appointment stays in the queue
  // (matches the client list's isUpcoming). Grouping still keys off start_time.
  const { data: rows, error } = await supabase
    .from("bookings")
    .select(BOOKING_DISPLAY_COLUMNS)
    .in("status", [...ACTIVE_BOOKING_STATUSES])
    .gte("end_time", new Date(now).toISOString())
    .order("start_time", { ascending: true })

  if (error) console.error("[admin-queue] read failed", error.message)

  const [{ bookings, contacts, noShowCounts }, unread] = await Promise.all([
    resolveAdminBookings(supabase, rows ?? [], "admin-queue"),
    getUnreadNotificationCount(),
  ])
  const weeks = groupIntoAgenda(bookings, now)

  return (
    <div className="space-y-4">
      {unread > 0 ? (
        <Link
          href="/admin/notifications"
          className="flex items-center gap-2 rounded-sm border border-border bg-secondary/10 px-4 py-2.5 font-functional text-sm text-foreground transition-colors hover:bg-secondary/20"
        >
          <Bell className="size-4 shrink-0 text-secondary" />
          {unread === 1 ? "1 new notification" : `${unread} new notifications`}
          <span className="ml-auto text-xs uppercase tracking-widest-lux text-muted-foreground">
            Review
          </span>
        </Link>
      ) : null}
      <AdminQueue
        weeks={weeks}
        contacts={contacts}
        noShowCounts={noShowCounts}
        now={now}
        loadError={Boolean(error)}
      />
    </div>
  )
}
