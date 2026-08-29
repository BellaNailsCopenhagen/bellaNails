import "server-only"

import { countNoShowsByClient, type BookingRow } from "@/db/bookings"
import type { Db } from "@/db/client"
import { listReleasesForBookings } from "@/db/media-releases"
import { fetchClientContacts } from "@/modules/clients/contacts"
import type { ClientContact } from "@/shared/contact"
import { groupReleasesByBooking } from "@/shared/media-release"
import { ADMIN_LOCALE } from "@/config/admin"
import { toDisplayBookings } from "./booking-view"
import type { DisplayBooking } from "@/shared/booking-view"

/**
 * Resolve booking rows for an admin list: names (catalog), contacts (the
 * clients table — name, email, phone), and no-show counts, fetched in parallel
 * and degrading independently. `context` labels failure logs by surface.
 */
export async function resolveAdminBookings(
  supabase: Db,
  rows: BookingRow[],
  context: string,
): Promise<{
  bookings: DisplayBooking[]
  contacts: Record<string, ClientContact>
  noShowCounts: Record<string, number>
}> {
  const [bookings, contacts, noShowCounts, releaseRows] = await Promise.all([
    toDisplayBookings(supabase, rows, ADMIN_LOCALE, context),
    fetchClientContacts(rows.map((row) => row.client_id)),
    countNoShowsByClient(
      supabase,
      rows.map((row) => row.client_id),
    ).catch((error) => {
      console.error(
        `[${context}] no-show reputation failed`,
        error instanceof Error ? error.message : error,
      )
      return {}
    }),
    listReleasesForBookings(
      supabase,
      rows.map((row) => row.id),
    ).catch(() => []),
  ])

  // Attach the media-release state per booking so the card can show it (incl.
  // future bookings pre-approved at confirmation).
  const releasesByBooking = groupReleasesByBooking(releaseRows)
  const withReleases = bookings.map((b) => ({
    ...b,
    releases: releasesByBooking.get(b.row.id) ?? [],
  }))

  return { bookings: withReleases, contacts, noShowCounts }
}
