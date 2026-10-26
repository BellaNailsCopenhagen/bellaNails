import type { Metadata } from "next"

import { BackToMore } from "@/components/admin/back-to-more"
import { Eyebrow, H2 } from "@/components/ui/typography"
import { EmptyState } from "@/components/ui/empty-state"
import { ClearReadButton } from "@/app/admin/notifications/_components/clear-read-button"
import { MarkAllReadButton } from "@/app/admin/notifications/_components/mark-all-read-button"
import { NotificationRow } from "@/app/admin/notifications/_components/notification-row"
import { getNotifications } from "@/modules/notifications/reads"
import { fetchClientContacts } from "@/modules/clients/contacts"
import { contactDisplayName } from "@/shared/contact"

export const metadata: Metadata = { title: "Notifications" }
export const dynamic = "force-dynamic"

/**
 * Studio notifications — owner-gated by the proxy. Split into what still needs
 * her and what she has already opened: tapping a notification marks it read and
 * moves it down here, so the top of the page is only ever the outstanding work.
 */
export default async function AdminNotificationsPage() {
  const notifications = await getNotifications()
  const ids = [...new Set(notifications.map((n) => n.clientId))]
  const contacts = ids.length ? await fetchClientContacts(ids) : {}
  const unread = notifications.filter((n) => !n.readAt)
  const earlier = notifications.filter((n) => n.readAt)
  const nameOf = (clientId: string) => contactDisplayName(contacts[clientId])

  return (
    <div className="space-y-8">
      <BackToMore />

      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <Eyebrow>Studio</Eyebrow>
          <H2>Notifications</H2>
        </div>
        {unread.length ? <MarkAllReadButton /> : null}
      </div>

      {notifications.length ? (
        <>
          {unread.length ? (
            <section className="space-y-3">
              <Eyebrow as="h2">Needs you</Eyebrow>
              <ul className="border-t border-border">
                {unread.map((n) => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    clientName={nameOf(n.clientId)}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {earlier.length ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Eyebrow as="h2">Earlier</Eyebrow>
                <ClearReadButton />
              </div>
              <ul className="border-t border-border opacity-70">
                {earlier.map((n) => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    clientName={nameOf(n.clientId)}
                  />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : (
        <EmptyState
          title="Nothing waiting"
          body="Booking requests, messages and consent changes land here."
        />
      )}
    </div>
  )
}
