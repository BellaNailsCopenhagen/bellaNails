import "server-only"

import { signedViewUrl, storageConfigured } from "@/platform/storage/supabase"
import type { Db } from "@/db/client"
import { listMediaForBookings } from "@/db/client-media"
import type { BookingThumb } from "@/shared/booking-view"

/**
 * A few attached-media thumbnails per booking, for admin cards. Private images
 * get a short-lived presigned URL. Keyed by booking id. Degrade-safe → {}.
 */
export async function getBookingMediaThumbs(
  supabase: Db,
  bookingIds: string[],
): Promise<Record<string, BookingThumb[]>> {
  const data = await listMediaForBookings(supabase, bookingIds)
  if (!data.length) {
    return {}
  }

  // Resolve presigned view URLs in parallel (private objects), then group.
  const configured = storageConfigured()
  const resolved = await Promise.all(
    data.map(async (m) => {
      let url = m.url
      if (configured && m.storage_key) {
        const signed = await signedViewUrl(m.storage_key)
        if (signed.ok) {
          url = signed.data.url
        }
      }

      return { bookingId: m.booking_id, id: m.id, url, kind: m.kind }
    }),
  )

  const byBooking: Record<string, BookingThumb[]> = {}
  for (const m of resolved) {
    if (!m.bookingId) {
      continue
    }
    ;(byBooking[m.bookingId] ??= []).push({
      id: m.id,
      url: m.url,
      kind: m.kind,
    })
  }

  return byBooking
}
