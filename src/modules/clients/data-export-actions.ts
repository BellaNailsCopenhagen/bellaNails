"use server"

import { listBookingRequestsForClient } from "@/db/booking-requests"
import { listBookingsForClient } from "@/db/bookings"
import { listDataConsents } from "@/db/client-consents"
import { listMediaForClient } from "@/db/client-media"
import { getClientProfile } from "@/db/clients"
import { listCommunicationsForClient } from "@/db/communications"
import { listReleasesForClient } from "@/db/media-releases"
import { listDesignRequestsForClient } from "@/db/design-requests"
import { listDesignMessagesForRequests } from "@/db/design-messages"
import { listOffersForClient } from "@/db/offers"
import { listTestimonialsForClient } from "@/db/testimonials"
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
      designRequests,
      offers,
      testimonials,
    ] = await Promise.all([
      getClientProfile(db, clientId),
      listBookingsForClient(db, clientId),
      listBookingRequestsForClient(db, clientId),
      listCommunicationsForClient(db, clientId),
      listReleasesForClient(db, clientId),
      listMediaForClient(db, clientId),
      listDataConsents(db, clientId),
      getTermsAcceptances(db, clientId),
      listDesignRequestsForClient(db, clientId),
      listOffersForClient(db, clientId),
      listTestimonialsForClient(db, clientId),
    ])

    // Thread bodies, keyed by request — loaded after the requests are known.
    const messages = await listDesignMessagesForRequests(
      db,
      designRequests.map((r) => r.id),
    )
    const messagesByRequest = new Map<string, typeof messages>()
    for (const message of messages) {
      messagesByRequest.set(message.request_id, [
        ...(messagesByRequest.get(message.request_id) ?? []),
        message,
      ])
    }

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
      // The client's own words to the studio, and what was offered back. The
      // message bodies are the client's personal data, so the whole thread
      // ships — both sides, since a reply only reads in context.
      designRequests: designRequests.map((r) => ({
        topic: r.topic,
        preferredWindow: r.preferred_window,
        status: r.status,
        askedAt: r.created_at,
        answeredAt: r.answered_at,
        messages: (messagesByRequest.get(r.id) ?? []).map((m) => ({
          from: m.author,
          body: m.body,
          sentAt: m.created_at,
        })),
      })),
      offers: offers.map((o) => ({
        name: o.name_en,
        durationMins: o.duration_mins,
        priceCents: o.price_cents,
        note: o.artist_note,
        expiresAt: o.expires_at,
        bookedAs: o.booking_id,
        offeredAt: o.created_at,
      })),
      // Includes what we KEEP after an erasure — the consent record is the
      // point of the retained shell, so an Art. 15 export has to show it.
      testimonials: testimonials.map((t) => ({
        status: t.status,
        showingOnSite: t.visible,
        name: t.author_name,
        occupation: t.occupation,
        words: t.body,
        bookingId: t.booking_id,
        consentVersion: t.consent_version,
        askedAt: t.requested_at,
        writtenAt: t.submitted_at,
        takenDownAt: t.withdrawn_at,
        wordsErasedAt: t.content_erased_at,
      })),
      mediaReleases: releases.map((r) => ({
        bookingId: r.booking_id,
        purpose: r.purpose,
        status: r.status,
        consentVersion: r.consent_version,
        grantedAt: r.granted_at,
        withdrawnAt: r.withdrawn_at,
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
