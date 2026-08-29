import type { Metadata } from "next"

import { AdminQueue } from "@/app/admin/_components/admin-queue"
import { SendRemindersButton } from "@/app/admin/_components/send-reminders-button"
import { AdminRequestCard } from "@/components/admin/admin-request-card"
import { Badge } from "@/components/ui/badge"
import { Eyebrow } from "@/components/ui/typography"
import { getAdminQueue, getPendingRequests } from "@/modules/booking"

export const metadata: Metadata = { title: "Queue" }

// Per-owner reads (session cookies) — declare dynamic so the build doesn't
// attempt a static prerender and log a spurious DYNAMIC_SERVER_USAGE notice.
export const dynamic = "force-dynamic"

/**
 * Admin queue (home) — booking requests to action first, then the forward agenda
 * across ALL clients (owner-reads-all RLS), grouped by week → day.
 */
export default async function AdminQueuePage() {
  // eslint-disable-next-line react-hooks/purity -- request-time clock read
  const now = Date.now()
  const [
    { weeks, contacts, noShowCounts, photosByBooking, loadError },
    { requests, contacts: requestContacts },
  ] = await Promise.all([getAdminQueue(now), getPendingRequests()])

  return (
    <>
      <div className="flex justify-end pb-4">
        <SendRemindersButton />
      </div>

      {/* Booking requests — outside-hours / over-limit asks awaiting the artist. */}
      {requests.length ? (
        <section className="space-y-3 pb-10">
          <div className="flex items-center gap-2">
            <Eyebrow as="h2">Requests</Eyebrow>
            <Badge variant="warning" size="xs">
              {requests.length}
            </Badge>
          </div>
          <div className="space-y-3">
            {requests.map((request) => (
              <AdminRequestCard
                key={request.id}
                request={request}
                contact={requestContacts[request.clientId]}
              />
            ))}
          </div>
        </section>
      ) : null}

      <AdminQueue
        weeks={weeks}
        contacts={contacts}
        noShowCounts={noShowCounts}
        now={now}
        photosByBooking={photosByBooking}
        loadError={loadError}
      />
    </>
  )
}
