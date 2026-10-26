import { getServiceNameCatalog } from "@/db/services"
import type { BookingRow } from "@/db/bookings"
import type { Db } from "@/db/client"
import { metaOf } from "@/shared/booking-policy"
import {
  toDisplayBooking,
  type BookingCatalog,
  type DisplayBooking,
} from "@/shared/booking-view"

/**
 * Resolve a set of booking rows to display shape in one pass: fetch the name
 * catalog once, then map each row with the pure mapper in shared. A catalog
 * failure degrades every row to the generic session label rather than
 * throwing. Client-safe (works with either Supabase client).
 */
export async function toDisplayBookings(
  db: Db,
  rows: BookingRow[],
  locale: string,
  /** Log context so a catalog failure names the calling surface. */
  context = "bookings",
): Promise<DisplayBooking[]> {
  let catalog: BookingCatalog = new Map()
  try {
    catalog = await getServiceNameCatalog(
      db,
      rows.map((row) => metaOf(row).serviceId),
    )
  } catch (error) {
    console.error(
      `[${context}] catalog resolution failed`,
      error instanceof Error ? error.message : error,
    )
  }

  return rows.map((row) => toDisplayBooking(row, catalog, locale))
}
