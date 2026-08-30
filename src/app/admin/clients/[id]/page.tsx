import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CalendarPlus, ChevronLeft, Mail, Phone, TriangleAlert } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Eyebrow, H2, BodySm } from "@/components/ui/typography"
import { ClientBookings } from "@/app/admin/clients/[id]/_components/client-bookings"
import { AdminClientTabs } from "@/app/admin/clients/[id]/_components/admin-client-tabs"
import {
  ClientMediaGallery,
  ClientDataConsent,
} from "@/app/admin/clients/[id]/_components/client-media-section"
import { ClientEmailLanguage } from "@/app/admin/clients/[id]/_components/client-email-language"
import { ClientCommunications } from "@/app/admin/clients/[id]/_components/client-communications"
import { ClientStatusBadge } from "@/app/admin/clients/[id]/_components/client-status-badge"
import { ClientTermsPanel } from "@/app/admin/clients/[id]/_components/client-terms-panel"
import { EraseClientButton } from "@/app/admin/clients/[id]/_components/erase-client-button"
import { cardActionNeutral } from "@/components/admin/card-action"
import { NoteFeed } from "@/components/admin/note-feed"
import { getClientBookingHistory } from "@/modules/booking"
import { getClientNotes, getClientPrivacyRecord } from "@/modules/clients"
import { getClientCommunications } from "@/modules/notifications"
import { routing } from "@/i18n/routing"
import { isActiveBookingStatus } from "@/shared/booking-status"
import { NO_SHOW_ALERT_THRESHOLD } from "@/shared/booking-policy"
import { contactDisplayName } from "@/shared/contact"
import { routes } from "@/shared/routes"
import { getHubAssets } from "@/modules/media/asset-hub"
import { formatStudioDayMonthYear } from "@/shared/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"

export const metadata: Metadata = { title: "Client" }

// Per-owner reads (session cookies) — dynamic, no static prerender attempt.
export const dynamic = "force-dynamic"

// Keep only digits and a leading "+", so odd separators can't break the URI.
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`

/**
 * A client's page — contact + full booking history for one `client_id`,
 * reached from the "View client" action on any booking card. Contact (from the
 * `clients` table) and no-show reputation reuse the shared admin resolve. GDPR
 * erasure (anonymize) is at the bottom; notes + record editing stay deferred.
 */
export default async function AdminClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams])
  const defaultTab = tab === "gallery" ? "gallery" : "appointment"
  // eslint-disable-next-line react-hooks/purity -- request-time clock read
  const now = Date.now()
  const { bookings, contacts, noShowCounts, photosByBooking } =
    await getClientBookingHistory(id)
  // The roster is "clients who have booked" — an id with no bookings isn't one.
  if (!bookings.length) notFound()

  const contact = contacts[id]
  const clientName = contactDisplayName(contact)
  const noShowCount = noShowCounts[id] ?? 0

  // Media + consent tables may not be migrated yet — degrade to empty.
  const [hubAssets, privacy, comms, clientNotes] = await Promise.all([
    getHubAssets(id).catch(() => []),
    getClientPrivacyRecord(id),
    getClientCommunications(id),
    getClientNotes(id),
  ])
  const { dataConsents, terms: termsAcceptances } = privacy

  // Booking picker for owner uploads: only sessions that have started (past or
  // current) and weren't cancelled/no-showed — you can't attach photos to a
  // future or void session. Bookings are newest-first.
  const attachableBookings = bookings.filter(
    (b) =>
      isActiveBookingStatus(b.row.status) &&
      !b.row.no_show_at &&
      new Date(b.row.start_time).getTime() <= now,
  )
  const bookingOptions = attachableBookings.map((b) => ({
    id: b.row.id,
    label: `${formatStudioDayMonthYear(new Date(b.row.start_time).getTime(), ADMIN_LOCALE)} · ${b.serviceName ?? "Session"}`,
  }))
  // Default to an ongoing session (started, not yet ended), else the most recent
  // attachable one.
  const defaultBookingId =
    attachableBookings.find(
      (b) => new Date(b.row.end_time).getTime() >= now,
    )?.row.id ??
    attachableBookings[0]?.row.id ??
    null

  return (
    <div className="space-y-14">
      <div className="space-y-3">
        <Link
          href={routes.admin.home}
          className="inline-flex items-center gap-1 font-functional text-xs uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />
          Queue
        </Link>

        <div className="space-y-1.5">
          <Eyebrow>Client</Eyebrow>
          <div className="flex flex-wrap items-center gap-3">
            <H2>{clientName}</H2>
            <ClientStatusBadge activated={Boolean(contact?.activated)} />
          </div>
          {contact?.phone || contact?.email ? (
            <div className="font-functional text-sm text-muted-foreground">
              {contact?.phone ? <p>{contact.phone}</p> : null}
              {contact?.email ? <p>{contact.email}</p> : null}
            </div>
          ) : null}
          {!contact?.activated ? (
            <BodySm className="text-xs">
              Booking-only account — reach out for appointment matters, not
              general outreach.
            </BodySm>
          ) : null}
        </div>

        {/* Reach the client, and a reputation flag if they're a repeat no-show. */}
        <div className="flex flex-wrap items-center gap-4">
          <Link href={routes.admin.newBooking({ client: id })} className={cardActionNeutral("gap-1")}>
            <CalendarPlus className="size-3.5" />
            New booking
          </Link>
          {contact?.phone ? (
            <a href={telHref(contact.phone)} className={cardActionNeutral("gap-1")}>
              <Phone className="size-3.5" />
              Call
            </a>
          ) : null}
          {contact?.email ? (
            <a
              href={`mailto:${contact.email}`}
              className={cardActionNeutral("gap-1")}
            >
              <Mail className="size-3.5" />
              Email
            </a>
          ) : null}
          {noShowCount >= NO_SHOW_ALERT_THRESHOLD ? (
            <Badge variant="destructive" size="xs" className="gap-1">
              <TriangleAlert className="size-3" />
              {noShowCount} no-shows
            </Badge>
          ) : null}
        </div>
      </div>

      {/* Private artist notes on this client — shown (read-only) on every one of
          their bookings too. */}
      <NoteFeed
        title="Notes"
        notes={clientNotes}
        clientId={id}
        editable
        emptyLabel="No notes on this client yet."
      />

      {/* Appointment history + the image gallery are tabbed; data-use consent
          stays on the page body below. */}
      <AdminClientTabs
        galleryCount={hubAssets.length}
        defaultTab={defaultTab}
        appointment={
          <ClientBookings
            bookings={bookings}
            contact={contact}
            clientNoShowCount={noShowCount}
            now={now}
            photosByBooking={photosByBooking}
          />
        }
        gallery={
          <ClientMediaGallery
            clientId={id}
            hubAssets={hubAssets}
            clientName={clientName}
            bookings={bookingOptions}
            defaultBookingId={defaultBookingId}
          />
        }
      />

      <ClientEmailLanguage
        clientId={id}
        locale={contact?.communicationLocale ?? routing.defaultLocale}
      />

      <ClientCommunications comms={comms} />

      <ClientDataConsent clientId={id} dataConsents={dataConsents} />

      <ClientTermsPanel acceptances={termsAcceptances} />

      {/* GDPR erasure — anonymize on request (irreversible). */}
      <div className="flex flex-col gap-2 border-t border-border pt-6">
        <BodySm className="text-xs text-muted-foreground">
          Erase this client&rsquo;s personal data on request (anonymize — keeps
          bookings + studio-owned photos).
        </BodySm>
        <EraseClientButton clientId={id} />
      </div>
    </div>
  )
}
