import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { Eyebrow, H2 } from "@/components/ui/typography"
import { EmptyState } from "@/components/ui/empty-state"
import { MarkAllReadButton } from "@/app/admin/notifications/_components/mark-all-read-button"
import { NotificationRow } from "@/app/admin/notifications/_components/notification-row"
import { getNotifications } from "@/modules/notifications/reads"
import { fetchClientContacts } from "@/modules/clients/contacts"
import { contactDisplayName } from "@/shared/contact"
import { routes } from "@/shared/routes"

export const metadata: Metadata = { title: "Notifications" }
export const dynamic = "force-dynamic"

/**
 * Studio notifications feed — owner-gated by the proxy. Each item can be marked
 * read or dismissed individually (a booking request handled from the email won't
 * clear itself), on top of "mark all read".
 */
export default async function AdminNotificationsPage() {
  const notifications = await getNotifications()
  const ids = [...new Set(notifications.map((n) => n.clientId))]
  const contacts = ids.length ? await fetchClientContacts(ids) : {}
  const hasUnread = notifications.some((n) => !n.readAt)

  return (
    <div className="space-y-6">
      <Link
        href={routes.admin.more}
        className="inline-flex items-center gap-1 font-functional text-xs uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        More
      </Link>

      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <Eyebrow>Studio</Eyebrow>
          <H2>Notifications</H2>
        </div>
        {hasUnread ? <MarkAllReadButton /> : null}
      </div>

      {notifications.length ? (
        <ul className="border-t border-border">
          {notifications.map((n) => (
            <NotificationRow
              key={n.id}
              notification={n}
              clientName={contactDisplayName(contacts[n.clientId])}
            />
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No notifications"
          body="Consent withdrawals and other studio alerts will appear here."
        />
      )}
    </div>
  )
}
