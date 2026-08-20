import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { presignedGet, storageConfigured } from "@/platform/storage/scaleway"
import type { Database } from "@/platform/supabase/types"

export type BookingThumb = { id: string; url: string; kind: string }

/**
 * A few attached-media thumbnails per booking, for admin cards. Private images
 * get a short-lived presigned URL. Keyed by booking id. Degrade-safe → {}.
 */
export async function getBookingMediaThumbs(
  supabase: SupabaseClient<Database>,
  bookingIds: string[],
): Promise<Record<string, BookingThumb[]>> {
  const ids = [...new Set(bookingIds.filter(Boolean))]
  if (!ids.length) return {}

  const { data, error } = await supabase
    .from("client_media")
    .select("id, booking_id, url, storage_key, kind")
    .in("booking_id", ids)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
  if (error || !data?.length) return {}

  // Resolve presigned view URLs in parallel (private objects), then group.
  const configured = storageConfigured()
  const resolved = await Promise.all(
    data.map(async (m) => {
      let url = m.url
      if (configured && m.storage_key) {
        const signed = await presignedGet(m.storage_key)
        if (signed.ok) url = signed.data.url
      }
      return { bookingId: m.booking_id, id: m.id, url, kind: m.kind }
    }),
  )

  const byBooking: Record<string, BookingThumb[]> = {}
  for (const m of resolved) {
    if (!m.bookingId) continue
    ;(byBooking[m.bookingId] ??= []).push({
      id: m.id,
      url: m.url,
      kind: m.kind,
    })
  }
  return byBooking
}
