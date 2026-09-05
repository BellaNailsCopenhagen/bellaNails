import "server-only"

import { listBookingLabelsByIds } from "@/db/bookings"
import { listReleasesForBookings } from "@/db/media-releases"
import { verifyBookingToken } from "@/modules/booking/manage-token"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"
import { metaOf } from "@/shared/booking-policy"
import {
  toReleaseCard,
  type ReleasePurpose,
  type ReleaseRequestCard,
  type ReleaseState,
} from "@/shared/media-release"

/**
 * The release request behind a signed guest link — the public /approve page's
 * one read. The token IS the authorization (it encodes the booking id and is
 * HMAC-signed), so this runs service-role. Returns null for a bad/expired token
 * or a booking with no release rows.
 */
export async function getReleaseRequestForToken(
  token: string,
): Promise<ReleaseRequestCard | null> {
  const bookingId = verifyBookingToken(token)
  if (!bookingId) return null

  const db = createSupabaseServiceRoleClient()
  const rows = await listReleasesForBookings(db, [bookingId])
  if (!rows.length) return null

  const [label] = await listBookingLabelsByIds(db, [bookingId])
  return toReleaseCard(
    bookingId,
    label ? metaOf(label) : {},
    label?.start_time ?? null,
    rows.map((r) => ({
      purpose: r.purpose as ReleasePurpose,
      status: r.status as ReleaseState,
    })),
  )
}
