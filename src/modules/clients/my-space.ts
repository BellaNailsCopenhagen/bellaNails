import "server-only"

import { listBookingLabelsForClient } from "@/db/bookings"
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
  fillReleasePurposes,
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
  /** One per past appointment — what the studio may show, and where. */
  permissions: ReleaseRequestCard[]
  requestCount: number
  profile: ClientProfile | null
}

export const EMPTY_MY_SPACE: MySpace = {
  media: [],
  dataConsents: [],
  permissions: [],
  requestCount: 0,
  profile: null,
}

/**
 * One card per appointment the client has actually had — the Permissions tab
 * lists them all, whether the studio ever asked about them or not.
 *
 * The list is driven by the BOOKINGS, not by the release rows: a client who was
 * never asked still sees the appointment and can offer it, one who said no still
 * sees the way back, and the set stops changing shape as answers are given.
 *
 * Cancelled is dropped — its release is void. So is a booking that has not
 * happened yet, UNLESS it already carries a release: the confirmation page lets
 * a client pre-approve at the moment they book, and consent that cannot be
 * withdrawn as easily as it was given is not consent (GDPR Art. 7(3)).
 */
async function getPermissionCards(
  db: Awaited<ReturnType<typeof createAuthedSupabaseServerClient>>,
  clientId: string,
  now: number,
): Promise<ReleaseRequestCard[]> {
  const [rows, bookings] = await Promise.all([
    listReleasesForClient(db, clientId),
    listBookingLabelsForClient(db, clientId),
  ])
  const byBooking = groupReleasesByBooking(rows)

  return bookings
    .filter(
      (booking) =>
        booking.status !== BOOKING_STATUS.cancelled &&
        (Date.parse(booking.start_time) <= now || byBooking.has(booking.id)),
    )
    .map((booking) =>
      toReleaseCard(
        booking.id,
        metaOf(booking),
        booking.start_time,
        fillReleasePurposes(byBooking.get(booking.id) ?? []),
      ),
    )
}

export async function getMySpace(clientId: string): Promise<MySpace> {
  const db = await createAuthedSupabaseServerClient()
  const [media, dataConsents, permissions, requestCount, profile] =
    await Promise.all([
      getClientMedia(db, clientId).catch(() => []),
      getClientDataConsents(db, clientId).catch(() => []),
      getPermissionCards(db, clientId, Date.now()).catch(() => []),
      pendingRequestCount(db, clientId).catch(() => 0),
      getClientProfile(db, clientId).catch(() => null),
    ])
  return { media, dataConsents, permissions, requestCount, profile }
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
