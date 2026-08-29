import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Eyebrow, H2, BodySm } from "@/components/ui/typography"
import { EmptyState } from "@/components/ui/empty-state"
import { MarkAllReadButton } from "@/app/admin/notifications/_components/mark-all-read-button"
import {
  getNotifications,
  type OwnerNotification,
} from "@/modules/notifications/reads"
import { fetchClientContacts } from "@/modules/clients/contacts"
import { contactDisplayName } from "@/shared/contact"
import { routes } from "@/shared/routes"
import { formatStudioDayMonthYear } from "@/shared/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"

export const metadata: Metadata = { title: "Notifications" }
export const dynamic = "force-dynamic"

const PURPOSE_LABEL: Record<string, string> = {
  website: "website",
  social: "social",
}

function describe(n: OwnerNotification): string {
  if (n.kind === "media_consent_withdrawn") {
    const where = PURPOSE_LABEL[n.purpose ?? ""] ?? "publishing"
    return `withdrew ${where} permission for a photo`
  }
  if (n.kind === "shared_image_deleted") {
    return "deleted a photo they had shared"
  }
  if (n.kind === "booking_request") {
    return "sent a booking request"
  }
  return "sent an update"
}

// A withdrawal opens the image in the asset hub (see where it's used + take it
// down); everything else goes to the client.
function hrefFor(n: OwnerNotification): string {
  if (n.kind === "media_consent_withdrawn" && n.clientMediaId) {
    return routes.admin.assetHighlight(n.clientMediaId)
  }
  // Booking requests live in the section on the admin home.
  if (n.kind === "booking_request") return routes.admin.home
  return routes.admin.client(n.clientId)
}

/**
 * Studio notifications feed — owner-gated by the proxy. First use: consent
 * withdrawals. A site withdrawal auto-unpublishes; a SOCIAL one needs the artist
 * to take the post down by hand, so it's flagged.
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
            <li key={n.id} className="border-b border-border">
              <Link
                href={hrefFor(n)}
                className="flex items-start justify-between gap-3 py-3"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-functional text-sm text-foreground">
                    <span className="font-medium">
                      {contactDisplayName(contacts[n.clientId])}
                    </span>{" "}
                    {describe(n)}
                    {!n.readAt ? (
                      <span className="ml-2 inline-block size-1.5 rounded-full bg-secondary align-middle" />
                    ) : null}
                  </p>
                  {n.kind === "shared_image_deleted" ? (
                    <BodySm className="text-xs text-destructive/80">
                      Fully removed — check any showcases or social posts that
                      used it.
                    </BodySm>
                  ) : n.purpose === "social" ? (
                    <BodySm className="text-xs text-destructive/80">
                      Remove it from your social posts — the website copy is
                      already gone.
                    </BodySm>
                  ) : (
                    <BodySm className="text-xs">
                      The website copy has been removed automatically.
                    </BodySm>
                  )}
                  <p className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground">
                    {formatStudioDayMonthYear(
                      new Date(n.createdAt).getTime(),
                      ADMIN_LOCALE,
                    )}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
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
