import type { Metadata } from "next"

import { CommandActions } from "@/app/admin/_components/command-actions"
import { CommandCenter } from "@/app/admin/_components/command-center"
import { CommandTick } from "@/app/admin/_components/command-tick"
import { QueueRealtime } from "@/app/admin/_components/queue-realtime"
import { AdminRequestCard } from "@/components/admin/admin-request-card"
import { Badge } from "@/components/ui/badge"
import { Eyebrow } from "@/components/ui/typography"
import { getAdminFocus, getPendingRequests } from "@/modules/booking"
import { getUnreadNotificationCount } from "@/modules/notifications"

export const metadata: Metadata = { title: "Today" }

// Per-owner reads (session cookies) — declare dynamic so the build doesn't
// attempt a static prerender and log a spurious DYNAMIC_SERVER_USAGE notice.
export const dynamic = "force-dynamic"

/**
 * Admin home — the command centre: what's in progress now, what's next, the
 * reminder batch + shortcuts, and booking requests to action. The full week/day
 * agenda lives at /admin/agenda.
 */
export default async function AdminHomePage() {
  // eslint-disable-next-line react-hooks/purity -- request-time clock read
  const now = Date.now()
  const [focus, { requests, contacts: requestContacts }, unread] =
    await Promise.all([
      getAdminFocus(now),
      getPendingRequests(),
      getUnreadNotificationCount(),
    ])

  return (
    <div className="space-y-8">
      <CommandCenter focus={focus} now={now} />
      <CommandActions unreadCount={unread} />

      {/* Booking requests — outside-hours / over-limit asks awaiting the artist. */}
      {requests.length ? (
        <section className="space-y-3">
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

      <QueueRealtime />
      <CommandTick />
    </div>
  )
}
