import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  toDisplayBookings,
  type BookingRow,
  type DisplayBooking,
} from "@/lib/booking-display"
import { fetchCalPhones } from "@/lib/booking-phones"
import { fetchNoShowCounts } from "@/lib/booking-reputation"
import { fetchClientContacts } from "@/lib/clerk/client-contacts"
import type { ClientContact } from "@/lib/clerk/contact"
import type { Database } from "@/lib/supabase/types"
import { ADMIN_LOCALE } from "@/config/admin"

/** Time span the rows cover, for the Cal phone lookup; null if none/unparsable. */
function bookingWindow(rows: BookingRow[]): { start: number; end: number } | null {
  let start = Infinity
  let end = -Infinity
  for (const row of rows) {
    const s = new Date(row.start_time).getTime()
    const e = new Date(row.end_time).getTime()
    if (Number.isFinite(s)) start = Math.min(start, s)
    if (Number.isFinite(e)) end = Math.max(end, e)
  }
  return Number.isFinite(start) && Number.isFinite(end) ? { start, end } : null
}

/**
 * Resolve booking rows for an admin list: names (catalog), contacts (Clerk),
 * no-show counts, and phones (Cal — the authoritative source), fetched in
 * parallel and degrading independently. `context` labels failure logs by surface.
 */
export async function resolveAdminBookings(
  supabase: SupabaseClient<Database>,
  rows: BookingRow[],
  context: string,
): Promise<{
  bookings: DisplayBooking[]
  contacts: Record<string, ClientContact>
  noShowCounts: Record<string, number>
}> {
  const window = bookingWindow(rows)
  const neededUids = new Set(
    rows.map((row) => row.cal_uid).filter((uid): uid is string => Boolean(uid)),
  )
  const [bookings, contacts, noShowCounts, calPhones] = await Promise.all([
    toDisplayBookings(supabase, rows, ADMIN_LOCALE, context),
    fetchClientContacts(rows.map((row) => row.clerk_user_id)),
    fetchNoShowCounts(
      supabase,
      rows.map((row) => row.clerk_user_id),
    ).catch((error) => {
      console.error(
        `[${context}] no-show reputation failed`,
        error instanceof Error ? error.message : error,
      )
      return {}
    }),
    window && neededUids.size
      ? fetchCalPhones(window.start, window.end, neededUids)
      : Promise.resolve<Record<string, string>>({}),
  ])

  // Each client's phone comes from their LATEST booking — numbers can change
  // between visits (phones keyed by cal_uid, contacts by clerk_user_id).
  const latestPhone: Record<string, { phone: string; at: number }> = {}
  for (const row of rows) {
    const phone = row.cal_uid ? calPhones[row.cal_uid] : undefined
    if (!phone) continue
    const startedAt = new Date(row.start_time).getTime()
    const at = Number.isFinite(startedAt) ? startedAt : -Infinity
    const current = latestPhone[row.clerk_user_id]
    if (!current || at > current.at) {
      latestPhone[row.clerk_user_id] = { phone, at }
    }
  }

  // Fill-only — never override a phone Clerk already has; create a minimal
  // contact if the Clerk lookup missed this client.
  for (const [clerkId, { phone }] of Object.entries(latestPhone)) {
    const existing = contacts[clerkId]
    if (existing) existing.phone ??= phone
    // No Clerk record resolved — treat as unactivated (booking-only).
    else
      contacts[clerkId] = {
        firstName: null,
        fullName: null,
        email: null,
        phone,
        activated: false,
      }
  }

  return { bookings, contacts, noShowCounts }
}
