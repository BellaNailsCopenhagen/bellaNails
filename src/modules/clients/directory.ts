import "server-only"

import { listBookingSpans } from "@/db/bookings"
import { createAuthedSupabaseServerClient } from "@/platform/supabase/server"

import { fetchClientContacts } from "./contacts"
import type { ClientContact } from "@/shared/contact"

export type DirectoryEntry = {
  id: string
  contact: ClientContact | undefined
  visits: number
  lastVisitMs: number | null
}

/**
 * The studio's roster: everyone who has ever booked, most recently active
 * first, with their visit count and last completed appointment. Derived from
 * bookings rather than the clients table — a row with no booking isn't a
 * client of the studio yet.
 */
export async function getClientDirectory(
  now: number,
): Promise<{ clients: DirectoryEntry[]; loadError: boolean }> {
  const db = await createAuthedSupabaseServerClient()

  let rows
  try {
    // Ordered desc so the first row per client is their most recent booking —
    // giving a recently-active-first roster from Map insertion order.
    rows = await listBookingSpans(db)
  } catch (error) {
    console.error(
      "[admin-clients] read failed",
      error instanceof Error ? error.message : error,
    )
    return { clients: [], loadError: true }
  }

  const byClient = new Map<string, { visits: number; lastVisitMs: number | null }>()
  for (const row of rows) {
    const agg = byClient.get(row.client_id) ?? { visits: 0, lastVisitMs: null }
    agg.visits += 1
    const endMs = new Date(row.end_time).getTime()
    // Last visit = most recent appointment that has already happened.
    if (endMs < now && (agg.lastVisitMs === null || endMs > agg.lastVisitMs)) {
      agg.lastVisitMs = endMs
    }
    byClient.set(row.client_id, agg)
  }

  const contacts = await fetchClientContacts([...byClient.keys()])
  const clients = [...byClient.entries()].map(([id, agg]) => ({
    id,
    contact: contacts[id],
    ...agg,
  }))
  return { clients, loadError: false }
}
