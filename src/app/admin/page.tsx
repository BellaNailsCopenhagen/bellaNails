import type { Metadata } from "next"

import { CommandActions } from "@/app/admin/_components/command-actions"
import { CommandCenter } from "@/app/admin/_components/command-center"
import { CommandTick } from "@/app/admin/_components/command-tick"
import { QueueRealtime } from "@/app/admin/_components/queue-realtime"
import { AdminRequestCard } from "@/components/admin/admin-request-card"
import { DesignRequestCard } from "@/components/admin/design-request-card"
import { HighlightTarget } from "@/components/ui/highlight-target"
import { Badge } from "@/components/ui/badge"
import { Eyebrow } from "@/components/ui/typography"
import { getAdminFocus, getPendingRequests } from "@/modules/booking"
import { getOpenDesignRequests, runDesignHousekeeping } from "@/modules/design"
import type { DesignQueue, DesignRequestView } from "@/modules/design"
import { getUnreadNotificationCount } from "@/modules/notifications"
import type { ClientContact } from "@/shared/contact"
import { singleParam } from "@/shared/search-params"

export const metadata: Metadata = { title: "Today" }

// Per-owner reads (session cookies) — declare dynamic so the build doesn't
// attempt a static prerender and log a spurious DYNAMIC_SERVER_USAGE notice.
export const dynamic = "force-dynamic"

/**
 * Admin home — the command centre: what's in progress now, what's next, the
 * reminder batch + shortcuts, and the two queues to action. The full week/day
 * agenda lives at /admin/agenda.
 *
 * `?focus=` scrolls to one card (from the notifications feed).
 */
export default async function AdminHomePage({
  searchParams,
}: PageProps<"/admin">) {
  // eslint-disable-next-line react-hooks/purity -- request-time clock read
  const now = Date.now()
  // Housekeeping runs alongside the reads rather than ahead of them: it is
  // throttled to once an hour, and the cards derive their live state from the
  // offer itself, so a not-yet-swept row still renders correctly.
  const [
    ,
    query,
    focus,
    { requests, contacts: requestContacts },
    design,
    unread,
  ] = await Promise.all([
    runDesignHousekeeping(),
    searchParams,
    getAdminFocus(now),
    getPendingRequests(),
    getOpenDesignRequests(now),
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

      <DesignMessages queue={design} />

      <HighlightTarget elementId={singleParam(query.focus) ?? null} />
      <QueueRealtime />
      <CommandTick />
    </div>
  )
}

/**
 * The design threads, split by whose turn it is: what she owes an answer on
 * first, then what is out with a client. Newest activity leads each group, so
 * the message that just arrived is the one at the top.
 */
function DesignMessages({ queue }: { queue: DesignQueue }) {
  if (!queue.needsAnswer.length && !queue.awaitingClient.length) return null

  return (
    <section className="space-y-6">
      <ThreadGroup
        title="Messages"
        badge="warning"
        threads={queue.needsAnswer}
        contacts={queue.contacts}
      />
      <ThreadGroup
        title="Offer sent · with the client"
        badge="outline"
        threads={queue.awaitingClient}
        contacts={queue.contacts}
      />
    </section>
  )
}

function ThreadGroup({
  title,
  badge,
  threads,
  contacts,
}: {
  title: string
  badge: "warning" | "outline"
  threads: DesignRequestView[]
  contacts: Record<string, ClientContact>
}) {
  if (!threads.length) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Eyebrow as="h2">{title}</Eyebrow>
        <Badge variant={badge} size="xs">
          {threads.length}
        </Badge>
      </div>
      <div className="space-y-3">
        {threads.map((thread) => (
          <DesignRequestCard
            key={thread.id}
            request={thread}
            contact={contacts[thread.clientId]}
          />
        ))}
      </div>
    </div>
  )
}
