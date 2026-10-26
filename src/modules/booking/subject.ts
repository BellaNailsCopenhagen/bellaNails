import "server-only"

import type { Db } from "@/db/client"
import { getOffer } from "@/db/offers"
import { getBookableService } from "@/db/services"
import type { SubjectRef } from "@/shared/booking-subject"
import { offerState } from "@/shared/offer"

/**
 * Resolves what a booking is for into the only four things the engine needs:
 * a name, a length, a price, and (for a service) its add-ons. One resolver, so
 * a catalog service and a one-time offer converge before any slot maths runs.
 *
 * Resolution is READ-safe: it validates nothing a slot lookup shouldn't care
 * about. Add-on compatibility is checked on the write path only
 * (`buildBookingDraft`) — doing it here would turn a transient read error into
 * a silent "no times available".
 *
 * The offer branch checks that the offer is LIVE — not withdrawn, not already
 * used, not expired. It deliberately does NOT check who is asking: an offer's
 * own `client_id` is who the booking belongs to, and reaching it at all requires
 * the signed token (see `offer-token.ts`). Callers that have a signed-in user
 * still pass `requireClientId` so a mismatched session is rejected outright.
 */
export type SubjectAddon = {
  id: string
  name_en: string
  name_dk: string | null
}

export type BookingSubject = {
  ref: SubjectRef
  /** Who the booking is for, when the subject itself decides it (an offer). */
  clientId: string | null
  nameEn: string
  nameDk: string | null
  durationMins: number
  priceCents: number
  addons: SubjectAddon[]
}

export type SubjectResult =
  { ok: true; subject: BookingSubject } | { ok: false; error: string }

export async function resolveBookingSubject(
  db: Db,
  ref: SubjectRef,
  opts: { requireClientId?: string; now?: number } = {},
): Promise<SubjectResult> {
  return ref.kind === "offer"
    ? resolveOffer(db, ref.offerId, opts)
    : resolveService(db, ref.serviceId, ref.addonIds)
}

async function resolveService(
  db: Db,
  serviceId: string,
  addonIds: string[],
): Promise<SubjectResult> {
  const service = await getBookableService(db, serviceId).catch(() => null)
  if (!service) {
    return { ok: false, error: "Service not found." }
  }

  const addons = service.service_addons
    .map((sa) => sa.addons)
    .filter(
      (a): a is NonNullable<typeof a> =>
        !!a && !a.archived_at && addonIds.includes(a.id),
    )

  return {
    ok: true,
    subject: {
      ref: { kind: "service", serviceId, addonIds },
      clientId: null,
      nameEn: service.name_en,
      nameDk: service.name_dk,
      durationMins:
        service.base_duration_mins +
        addons.reduce((sum, a) => sum + a.extra_duration_mins, 0),
      priceCents:
        service.base_price_cents +
        addons.reduce((sum, a) => sum + a.extra_price_cents, 0),
      addons: addons.map((a) => ({
        id: a.id,
        name_en: a.name_en,
        name_dk: a.name_dk,
      })),
    },
  }
}

async function resolveOffer(
  db: Db,
  offerId: string,
  opts: { requireClientId?: string; now?: number },
): Promise<SubjectResult> {
  const offer = await getOffer(db, offerId).catch(() => null)
  if (!offer) {
    return { ok: false, error: "This offer no longer exists." }
  }

  const state = offerState(offer, opts.now ?? Date.now())
  if (state !== "live") {
    // Admin-facing wording; the client's page renders offerBlockedReason instead.
    return { ok: false, error: `This offer is ${state}.` }
  }
  if (opts.requireClientId && opts.requireClientId !== offer.client_id) {
    return { ok: false, error: "This offer belongs to someone else." }
  }

  return {
    ok: true,
    subject: {
      ref: { kind: "offer", offerId },
      clientId: offer.client_id,
      nameEn: offer.name_en,
      nameDk: offer.name_dk,
      durationMins: offer.duration_mins,
      priceCents: offer.price_cents,
      addons: [],
    },
  }
}
