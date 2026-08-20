import type { Metadata } from "next"

import { AdminQueue } from "@/components/admin/admin-queue"
import { getAdminQueue } from "@/modules/booking"

export const metadata: Metadata = { title: "Queue" }

// Per-owner reads (session cookies) — declare dynamic so the build doesn't
// attempt a static prerender and log a spurious DYNAMIC_SERVER_USAGE notice.
export const dynamic = "force-dynamic"

/**
 * Admin queue (home) — the forward agenda across ALL clients (owner-reads-all
 * RLS), grouped by week → day and handed to the client AdminQueue for
 * collapse/expand.
 */
export default async function AdminQueuePage() {
  // eslint-disable-next-line react-hooks/purity -- request-time clock read
  const now = Date.now()
  const { weeks, contacts, noShowCounts, photosByBooking, loadError } =
    await getAdminQueue(now)

  return (
    <AdminQueue
      weeks={weeks}
      contacts={contacts}
      noShowCounts={noShowCounts}
      now={now}
      photosByBooking={photosByBooking}
      loadError={loadError}
    />
  )
}
