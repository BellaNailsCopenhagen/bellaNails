import type { Metadata } from "next"
import { currentUser } from "@clerk/nextjs/server"

import { createAuthedSupabaseServerClient } from "@/lib/supabase/server"
import { ACTIVE_BOOKING_STATUSES } from "@/lib/booking-status"
import { formatStudioDate } from "@/lib/studio-time"
import {
  Body,
  Display,
  Eyebrow,
  HeadingLine,
  HeadingMuted,
} from "@/components/ui/typography"
import { TintedCard } from "@/components/ui/tinted-card"

export const metadata: Metadata = { title: "Queue" }

// Per-owner reads (session cookies) — declare dynamic so the build doesn't
// attempt a static prerender and log a spurious DYNAMIC_SERVER_USAGE notice.
export const dynamic = "force-dynamic"

/**
 * Admin dashboard (Queue placeholder). Proves the whole chain end to end:
 * owner-gated route → authed Supabase read under the new owner-reads-all RLS →
 * a real upcoming-booking count. The live queue itself lands in Task 02.
 */
export default async function AdminDashboardPage() {
  const now = new Date()
  const supabase = createAuthedSupabaseServerClient()

  const [user, { count, error }] = await Promise.all([
    currentUser(),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .in("status", [...ACTIVE_BOOKING_STATUSES])
      .gt("start_time", now.toISOString()),
  ])

  const upcoming = error ? null : (count ?? 0)
  const firstName = user?.firstName?.trim() || "Studio"

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <Eyebrow>{formatStudioDate(now.toISOString(), "en")}</Eyebrow>
        <Display>
          <HeadingLine>Good day</HeadingLine>
          <HeadingMuted>{firstName}</HeadingMuted>
        </Display>
      </div>

      <TintedCard className="flex items-baseline justify-between">
        <div className="space-y-1">
          <Eyebrow>Upcoming</Eyebrow>
          <Body className="text-muted-foreground">
            {upcoming === null
              ? "Couldn’t load your bookings just now."
              : upcoming === 1
                ? "appointment ahead"
                : "appointments ahead"}
          </Body>
        </div>
        <span className="font-editorial text-5xl leading-none">
          {upcoming ?? "—"}
        </span>
      </TintedCard>

      <Body className="text-muted-foreground">
        The live queue with client cards and realtime updates arrives next.
      </Body>
    </div>
  )
}
