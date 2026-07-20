import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  toDisplayBookings,
  type BookingRow,
  type DisplayBooking,
} from "@/lib/booking-display"
import { fetchClientContacts } from "@/lib/clerk/client-contacts"
import type { ClientContact } from "@/lib/clerk/contact"
import type { Database } from "@/lib/supabase/types"
import { ADMIN_LOCALE } from "@/config/admin"

/**
 * Resolve admin booking rows for a list surface: display names (Supabase
 * catalog) and client contacts (Clerk), fetched in parallel. Shared by the
 * queue and history pages so the two-source resolve lives in one place.
 * `context` labels catalog-failure logs by surface.
 */
export async function resolveAdminBookings(
  supabase: SupabaseClient<Database>,
  rows: BookingRow[],
  context: string,
): Promise<{
  bookings: DisplayBooking[]
  contacts: Record<string, ClientContact>
}> {
  const [bookings, contacts] = await Promise.all([
    toDisplayBookings(supabase, rows, ADMIN_LOCALE, context),
    fetchClientContacts(rows.map((row) => row.clerk_user_id)),
  ])
  return { bookings, contacts }
}
