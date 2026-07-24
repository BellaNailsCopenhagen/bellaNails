import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft, Mail, Phone, TriangleAlert } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Eyebrow, H2, BodySm } from "@/components/ui/typography"
import { ClientBookings } from "@/components/admin/client-bookings"
import { ClientStatusBadge } from "@/components/admin/client-status-badge"
import { cardActionNeutral } from "@/components/admin/card-action"
import { BOOKING_DISPLAY_COLUMNS } from "@/lib/booking-display"
import { resolveAdminBookings } from "@/lib/admin/bookings"
import { NO_SHOW_ALERT_THRESHOLD } from "@/lib/booking-reputation"
import { contactDisplayName } from "@/lib/clerk/contact"
import { createAuthedSupabaseServerClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Client" }

// Per-owner reads (session cookies) — dynamic, no static prerender attempt.
export const dynamic = "force-dynamic"

// Keep only digits and a leading "+", so odd separators can't break the URI.
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`

/**
 * A client's page — contact + full booking history for one `clerk_user_id`,
 * reached from the "View client" action on any booking card. Contact (Clerk +
 * Cal phone) and no-show reputation reuse the shared admin resolve. Notes,
 * photos, record editing and GDPR erasure are Task 07's larger scope, deferred.
 */
export default async function AdminClientPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  // eslint-disable-next-line react-hooks/purity -- request-time clock read
  const now = Date.now()
  const supabase = createAuthedSupabaseServerClient()

  const { data: rows, error } = await supabase
    .from("bookings")
    .select(BOOKING_DISPLAY_COLUMNS)
    .eq("clerk_user_id", id)
    .order("start_time", { ascending: false })

  if (error) console.error("[admin-client] read failed", error.message)
  // The roster is "clients who have booked" — an id with no bookings isn't one.
  if (!rows?.length) notFound()

  const { bookings, contacts, noShowCounts } = await resolveAdminBookings(
    supabase,
    rows,
    "admin-client",
  )
  const contact = contacts[id]
  const clientName = contactDisplayName(contact)
  const noShowCount = noShowCounts[id] ?? 0

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link
          href="/admin"
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

      <ClientBookings
        bookings={bookings}
        contact={contact}
        clientNoShowCount={noShowCount}
        now={now}
      />
    </div>
  )
}
