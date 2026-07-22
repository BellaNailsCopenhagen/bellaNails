import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { H2 } from "@/components/ui/typography"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { AdminBookings } from "@/components/admin/admin-bookings"
import { createAuthedSupabaseServerClient } from "@/lib/supabase/server"
import { BOOKING_DISPLAY_COLUMNS } from "@/lib/booking-display"
import { resolveAdminBookings } from "@/lib/admin/bookings"

export const metadata: Metadata = { title: "Appointments" }

// Per-owner reads (session cookies) — dynamic, no static prerender attempt.
export const dynamic = "force-dynamic"

// Cap the past window; full search/pagination is a later refinement. Upcoming
// is unbounded but naturally small (only bookings ahead).
const PAST_LIMIT = 200

/**
 * Appointments — the full browse across the whole studio: every upcoming
 * appointment (active or cancelled) plus recent past ones. Granularity (All /
 * Weekly / Monthly), status filter, and collapse live in the client
 * AdminBookings; this page just fetches and resolves. Distinct from the Queue,
 * the focused live view. (Internal code keeps the "bookings" table term.)
 */
export default async function AdminAppointmentsPage() {
  const now = new Date()
  const nowIso = now.toISOString()
  const supabase = createAuthedSupabaseServerClient()

  const [upcomingRes, pastRes] = await Promise.all([
    supabase
      .from("bookings")
      .select(BOOKING_DISPLAY_COLUMNS)
      .gte("end_time", nowIso)
      .order("start_time", { ascending: true }),
    supabase
      .from("bookings")
      .select(BOOKING_DISPLAY_COLUMNS)
      .lt("end_time", nowIso)
      .order("start_time", { ascending: false })
      .limit(PAST_LIMIT),
  ])

  const error = upcomingRes.error ?? pastRes.error
  if (error) console.error("[admin-appointments] read failed", error.message)

  const { bookings, contacts, noShowCounts } = await resolveAdminBookings(
    supabase,
    [...(upcomingRes.data ?? []), ...(pastRes.data ?? [])],
    "admin-appointments",
  )

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 font-functional text-xs uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />
          Queue
        </Link>
        <H2>Appointments</H2>
      </div>

      {error ? (
        <ErrorState
          title="Couldn’t load appointments"
          body="Something went wrong reaching the studio's appointments. Try again in a moment."
        />
      ) : bookings.length === 0 ? (
        <EmptyState
          title="No appointments yet"
          body="Upcoming and past appointments will appear here."
        />
      ) : (
        <AdminBookings
          bookings={bookings}
          contacts={contacts}
          noShowCounts={noShowCounts}
          now={now.getTime()}
        />
      )}
    </div>
  )
}
