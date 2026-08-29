"use server"

import { listBookingRequestsForClient } from "@/db/booking-requests"
import { listBookingsForClient } from "@/db/bookings"
import { listDataConsents } from "@/db/client-consents"
import { listMediaForClient } from "@/db/client-media"
import { getClientProfile } from "@/db/clients"
import { listCommunicationsForClient } from "@/db/communications"
import { listReleasesForClient } from "@/db/media-releases"
import { getCurrentUser } from "@/modules/identity/server"
import { getTermsAcceptances } from "@/modules/terms"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"
import { metaOf } from "@/shared/booking-policy"

/**
 * Self-service DSAR (GDPR Art. 15 access + Art. 20 portability): the signed-in
 * client downloads everything we hold on them as one machine-readable JSON.
 * Gathered service-role but scoped strictly to the caller's own id (from the
 * session, never the client), across every table that references them.
 */

export type DataExportResult =
  | { ok: true; filename: string; json: string }
  | { ok: false; error: string }

export async function requestMyDataExport(): Promise<DataExportResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "unauthorized" }

  try {
    const db = createSupabaseServiceRoleClient()
    const clientId = user.id
    const [
      profile,
      bookings,
      requests,
      communications,
      releases,
      media,
      dataConsents,
      terms,
    ] = await Promise.all([
      getClientProfile(db, clientId),
      listBookingsForClient(db, clientId),
      listBookingRequestsForClient(db, clientId),
      listCommunicationsForClient(db, clientId),
      listReleasesForClient(db, clientId),
      listMediaForClient(db, clientId),
      listDataConsents(db, clientId),
      getTermsAcceptances(db, clientId),
    ])

    const data = {
      exportedAt: new Date().toISOString(),
      profile: profile
        ? { name: profile.name, email: profile.email, phone: profile.phone }
        : null,
      bookings: bookings.map((b) => {
        const meta = metaOf(b)
        return {
          start: b.start_time,
          end: b.end_time,
          status: b.status,
          priceKr: b.total_price_cents / 100,
          service: meta.serviceNameEn ?? meta.serviceNameDk ?? null,
          addons: (meta.addonSnapshots ?? []).map((a) => a.nameEn),
        }
      }),
      communications: communications.map((c) => ({
        kind: c.kind,
        channel: c.channel,
        trigger: c.trigger,
        status: c.status,
        recipient: c.recipient,
        sentAt: c.created_at,
      })),
      bookingRequests: requests.map((r) => {
        const meta = metaOf(r)
        return {
          kind: r.kind,
          requestedStart: r.start_time,
          service: meta.serviceNameEn ?? meta.serviceNameDk ?? null,
          message: r.message,
          status: r.status,
          requestedAt: r.created_at,
        }
      }),
      mediaReleases: releases.map((r) => ({
        bookingId: r.booking_id,
        purpose: r.purpose,
        status: r.status,
      })),
      media: media.map((m) => ({
        kind: m.kind,
        caption: m.caption,
        bookingId: m.booking_id,
        addedAt: m.created_at,
      })),
      dataConsents: dataConsents.map((c) => ({
        purpose: c.purpose,
        status: c.status,
      })),
      termsAccepted: terms,
    }

    const filename = `bella-nails-my-data-${data.exportedAt.slice(0, 10)}.json`
    return { ok: true, filename, json: JSON.stringify(data, null, 2) }
  } catch (error) {
    console.error(
      "[data-export] failed —",
      error instanceof Error ? error.message : error,
    )
    return { ok: false, error: "Couldn’t build your export — please try again." }
  }
}
