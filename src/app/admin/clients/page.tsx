import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { H2 } from "@/components/ui/typography"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import {
  ClientDirectory,
  type ClientRosterEntry,
} from "@/components/admin/client-directory"
import { fetchClientContacts } from "@/lib/identity/client-contacts"
import { contactDisplayName, type ClientContact } from "@/lib/identity/contact"
import { createAuthedSupabaseServerClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Clients" }

// Per-owner reads (session cookies) — dynamic, no static prerender attempt.
export const dynamic = "force-dynamic"

/** Per-client aggregates derived from their booking rows. */
type Agg = { count: number; lastVisitMs: number | null }

function toRosterEntry(
  id: string,
  agg: Agg,
  contact: ClientContact | undefined,
): ClientRosterEntry {
  return {
    id,
    name: contactDisplayName(contact),
    activated: Boolean(contact?.activated),
    count: agg.count,
    lastVisitMs: agg.lastVisitMs,
    // Name + email haystack so search hits last name and email fragments.
    search: [contact?.firstName, contact?.fullName, contact?.email]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
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
  const supabase = await createAuthedSupabaseServerClient()

  // Ordered desc so the first row per client is their most recent booking —
  // giving a recently-active-first roster from Map insertion order.
  const { data: rows, error } = await supabase
    .from("bookings")
    .select("client_id, start_time, end_time")
    .order("start_time", { ascending: false })

  if (error) console.error("[admin-clients] read failed", error.message)

  const byClient = new Map<string, Agg>()
  for (const row of rows ?? []) {
    const agg = byClient.get(row.client_id) ?? { count: 0, lastVisitMs: null }
    agg.count += 1
    const endMs = new Date(row.end_time).getTime()
    // Last visit = most recent appointment that has already happened.
    if (endMs < now && (agg.lastVisitMs === null || endMs > agg.lastVisitMs)) {
      agg.lastVisitMs = endMs
    }
    byClient.set(row.client_id, agg)
  }

  // Resolved from the clients table in one `.in(...)` query.
  const contacts = await fetchClientContacts([...byClient.keys()])
  const clients: ClientRosterEntry[] = [...byClient.entries()].map(
    ([id, agg]) => toRosterEntry(id, agg, contacts[id]),
  )

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 font-functional text-xs uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />
          Queue
        </Link>
        <H2>
          Clients{clients.length ? ` · ${clients.length}` : ""}
        </H2>
      </div>

      {error ? (
        <ErrorState
          title="Couldn’t load clients"
          body="Something went wrong reaching the studio's clients. Try again in a moment."
        />
      ) : clients.length === 0 ? (
        <EmptyState
          title="No clients yet"
          body="Clients appear here once they've booked."
        />
      ) : (
        <ClientDirectory clients={clients} />
      )}
    </div>
  )
}
