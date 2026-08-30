import type { Metadata } from "next"

import { AdminQueue } from "@/app/admin/_components/admin-queue"
import { getAdminQueue } from "@/modules/booking"

export const metadata: Metadata = { title: "Agenda" }

// Per-owner reads (session cookies) — dynamic so the build skips a static prerender.
export const dynamic = "force-dynamic"

/**
 * The full forward agenda across ALL clients (owner-reads-all RLS), grouped by
 * week → day. Moved off the home when it became the command centre; reached via
 * the command centre's "Agenda" shortcut + the More hub.
 */
export default async function AdminAgendaPage() {
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
