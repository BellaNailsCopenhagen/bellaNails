import "server-only"

import { listBookingLabelsByIds } from "@/db/bookings"
import { getClientProfile, type ClientProfile } from "@/db/clients"
import { listReleasesForClient } from "@/db/media-releases"
import { createAuthedSupabaseServerClient } from "@/platform/supabase/server"
import {
  getClientDataConsents,
  getClientMedia,
  pendingRequestCount,
  type ClientMediaItem,
  type DataConsentItem,
} from "@/modules/media"
import { getTermsAcceptances, type TermsAcceptance } from "@/modules/terms"
import { metaOf } from "@/shared/booking-policy"
import { BOOKING_STATUS } from "@/shared/booking-status"
import {
  groupReleasesByBooking,
  toReleaseCard,
  type ReleaseRequestCard,
} from "@/shared/media-release"

/**
 * Everything the signed-in client's own page renders, in one call. Each part
 * degrades independently — the media and consent tables may not be migrated in
 * a given environment, and a missing one must not take the page down.
 */
export type MySpace = {
  media: ClientMediaItem[]
  dataConsents: DataConsentItem[]
  releaseRequests: ReleaseRequestCard[]
  requestCount: number
  profile: ClientProfile | null
}

export const EMPTY_MY_SPACE: MySpace = {
  media: [],
  dataConsents: [],
  releaseRequests: [],
  requestCount: 0,
  profile: null,
}

/** Booking-level media releases the client can act on. Every booking that was
    ever asked about is kept, including ones where they said no or later
    withdrew: re-granting has to be as easy as withdrawing, and they cannot
    re-grant what the page refuses to show them. */
async function getReleaseRequests(
  db: Awaited<ReturnType<typeof createAuthedSupabaseServerClient>>,
  clientId: string,
): Promise<ReleaseRequestCard[]> {
  const rows = await listReleasesForClient(db, clientId)
  const byBooking = [...groupReleasesByBooking(rows).entries()]
  if (!byBooking.length) return []

  const labels = await listBookingLabelsByIds(
    db,
    byBooking.map(([bookingId]) => bookingId),
  )
  const labelById = new Map(labels.map((b) => [b.id, b]))

  return byBooking
    // A cancelled booking's release is void — drop it from the UI.
    .filter(([bookingId]) => {
      const booking = labelById.get(bookingId)
      return !booking || booking.status !== BOOKING_STATUS.cancelled
    })
    .map(([bookingId, purposes]) => {
      const booking = labelById.get(bookingId)
      return toReleaseCard(
        bookingId,
        booking ? metaOf(booking) : {},
        booking?.start_time ?? null,
        purposes,
      )
    })
    .sort((a, b) => (b.startIso ?? "").localeCompare(a.startIso ?? ""))
}

export async function getMySpace(clientId: string): Promise<MySpace> {
  const db = await createAuthedSupabaseServerClient()
  const [media, dataConsents, releaseRequests, requestCount, profile] =
    await Promise.all([
      getClientMedia(db, clientId).catch(() => []),
      getClientDataConsents(db, clientId).catch(() => []),
      getReleaseRequests(db, clientId).catch(() => []),
      pendingRequestCount(db, clientId).catch(() => 0),
      getClientProfile(db, clientId).catch(() => null),
    ])
  return { media, dataConsents, releaseRequests, requestCount, profile }
}

/** The consent + terms panels on a client's admin detail page. */
export async function getClientPrivacyRecord(clientId: string): Promise<{
  dataConsents: DataConsentItem[]
  terms: TermsAcceptance[]
}> {
  const db = await createAuthedSupabaseServerClient()
  const [dataConsents, terms] = await Promise.all([
    getClientDataConsents(db, clientId).catch(() => []),
    getTermsAcceptances(db, clientId).catch(() => []),
  ])
  return { dataConsents, terms }
}
