import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { H2 } from "@/components/ui/typography"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import {
  ClientDirectory,
  type ClientRosterEntry,
} from "@/app/admin/clients/_components/client-directory"
import { getBlockedIdentities } from "@/modules/booking/protection"
import { getClientDirectory, type DirectoryEntry } from "@/modules/clients"
import { clientSearchText } from "@/shared/client-search"
import { contactDisplayName } from "@/shared/contact"
import { routes } from "@/shared/routes"

export const metadata: Metadata = { title: "Clients" }

// Per-owner reads (session cookies) — dynamic, no static prerender attempt.
export const dynamic = "force-dynamic"

function toRosterEntry(entry: DirectoryEntry): ClientRosterEntry {
  const { contact } = entry
  return {
    id: entry.id,
    name: contactDisplayName(contact),
    activated: Boolean(contact?.activated),
    count: entry.visits,
    lastVisitMs: entry.lastVisitMs,
    // Name + phone + email haystack — searchable by any of them.
    search: clientSearchText({
      firstName: contact?.firstName,
      fullName: contact?.fullName,
      email: contact?.email,
      phone: contact?.phone,
    }),
  }
}

/**
 * Client directory — the roster is `distinct client_id from bookings`
 * (owner-reads-all RLS), with names/emails resolved from the `clients` table.
 * Aggregates each client's booking count + last visit for the row caption;
 * ordered most-recently-active first. Notes/photos/CRUD are Task 07's larger
 * scope, deferred (see docs/tasks/admin/07-clients.md).
 */
export default async function AdminClientsPage() {
  // eslint-disable-next-line react-hooks/purity -- request-time clock read
  const now = Date.now()
  const [{ clients: roster, loadError }, blocked] = await Promise.all([
    getClientDirectory(now),
    getBlockedIdentities(),
  ])
  const clients: ClientRosterEntry[] = roster.map(toRosterEntry)

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link
          href={routes.admin.home}
          className="inline-flex items-center gap-1 font-functional text-xs uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />
          Queue
        </Link>
        <H2>
          Clients{clients.length ? ` · ${clients.length}` : ""}
        </H2>
      </div>

      {loadError ? (
        <ErrorState
          title="Couldn’t load clients"
          body="Something went wrong reaching the studio's clients. Try again in a moment."
        />
      ) : clients.length === 0 && blocked.length === 0 ? (
        <EmptyState
          title="No clients yet"
          body="Clients appear here once they've booked."
        />
      ) : (
        <ClientDirectory clients={clients} blocked={blocked} />
      )}
    </div>
  )
}
