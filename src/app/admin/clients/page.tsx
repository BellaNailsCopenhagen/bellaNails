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
import { fetchClientContacts } from "@/lib/clerk/client-contacts"
import { contactDisplayName, type ClientContact } from "@/lib/clerk/contact"
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
 * Client directory — the roster is `distinct clerk_user_id from bookings`
 * (owner-reads-all RLS), with names/emails resolved live from Clerk (never
 * persisted). Aggregates each client's booking count + last visit for the row
 * caption; ordered most-recently-active first. Notes/photos/CRUD are Task 07's
 * larger scope, deferred (see docs/tasks/admin/07-clients.md).
 */
export default async function AdminClientsPage() {
  // eslint-disable-next-line react-hooks/purity -- request-time clock read
  const now = Date.now()
  const supabase = createAuthedSupabaseServerClient()

  // Ordered desc so the first row per client is their most recent booking —
  // giving a recently-active-first roster from Map insertion order.
  const { data: rows, error } = await supabase
    .from("bookings")
    .select("clerk_user_id, start_time, end_time")
    .order("start_time", { ascending: false })

  if (error) console.error("[admin-clients] read failed", error.message)

  const byClient = new Map<string, Agg>()
  for (const row of rows ?? []) {
    const agg = byClient.get(row.clerk_user_id) ?? { count: 0, lastVisitMs: null }
    agg.count += 1
    const endMs = new Date(row.end_time).getTime()
    // Last visit = most recent appointment that has already happened.
    if (endMs < now && (agg.lastVisitMs === null || endMs > agg.lastVisitMs)) {
      agg.lastVisitMs = endMs
    }
    byClient.set(row.clerk_user_id, agg)
  }

  // Caps at 500 (Clerk's page limit) — clients past that show as "Client" and
  // aren't searchable. Accepted until identity moves to Supabase, where the
  // roster + search become a paginated DB query (see the auth-ownership plan).
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
