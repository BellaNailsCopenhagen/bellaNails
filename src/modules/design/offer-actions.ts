"use server"

import { revalidatePath } from "next/cache"

import { cancelBookingById, insertBooking } from "@/db/bookings"
import { purgeExpiredRateLimits } from "@/db/rate-limits"
import type { Db } from "@/db/client"
import { getDesignRequest, updateDesignRequest } from "@/db/design-requests"
import {
  claimOfferForBooking,
  getLiveOfferForRequest,
  getOffer,
  insertOffer,
  listExpiredLiveOffers,
  updateOffer,
  type OfferRow,
} from "@/db/offers"
import { resolveLocale } from "@/i18n/routing"
import { buildBookingDraft } from "@/modules/booking/booking-draft"
import { manageUrlFor } from "@/modules/booking/manage-token"
import { offerUrlFor } from "@/modules/design/offer-token"
import { stampArtistReply } from "@/modules/design/reply-stamp"
import { verifyOfferToken } from "@/modules/design/offer-token"
import { fetchClientContacts } from "@/modules/clients"
import { getCurrentUser } from "@/modules/identity/server"
import { requireOwner } from "@/modules/identity/require-owner"
import { sendBookingConfirmationEmail } from "@/modules/notifications/booking-email"
import {
  recordCommunication,
  statusFromEmailResult,
} from "@/modules/notifications/communications"
import { sendOfferEmail } from "@/modules/notifications/design-email"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"
import { localizedBookingNames, metaOf } from "@/shared/booking-policy"
import {
  purgeExpiredDesignRefs,
  purgeOrphanedRefObjects,
} from "@/modules/design/refs"
import { offerRef } from "@/shared/booking-subject"
import { MAX_MESSAGE_LENGTH } from "@/shared/design"
import { takeToken, type RateLimitState } from "@/shared/rate-limit"
import { offerExpiryFrom, offerState, OFFER_DEFAULT_DAYS } from "@/shared/offer"
import { routes, revalidatePatterns } from "@/shared/routes"

/**
 * The artist's one-time offer: create it, withdraw it, and turn it into a real
 * booking — either by the client following their signed link, or by the artist
 * placing it herself when someone needs a time urgently.
 *
 * The offer is never a `services` row, so the signed token is the only way a
 * client reaches it and there is no catalog entry to over-permission.
 */

export type OfferActionResult = { ok: true } | { ok: false; error: string }

const MAX_HOLD_DAYS = 90

export type CreateOfferInput = {
  requestId: string
  nameEn: string
  nameDk?: string
  durationMins: number
  priceCents: number
  artistNote?: string
  /** How long the client has to book it. Defaults to the standard hold. */
  holdDays?: number
}

export async function createOffer(
  input: CreateOfferInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "Not authorized." }

  const nameEn = input.nameEn.trim()
  if (!nameEn) return { ok: false, error: "Give the offer a name." }
  if (!Number.isFinite(input.durationMins) || input.durationMins <= 0) {
    return { ok: false, error: "Set how long it takes." }
  }
  if (!Number.isFinite(input.priceCents) || input.priceCents < 0) {
    return { ok: false, error: "Set a price." }
  }
  const note = input.artistNote?.trim().slice(0, MAX_MESSAGE_LENGTH) || null
  const holdDays = clampHold(input.holdDays)

  const request = await getDesignRequest(db, input.requestId)
  if (!request) return { ok: false, error: "Request not found." }

  // The one-live-offer index keys off `closed_at`, which only the (throttled)
  // sweep sets — so an offer that has merely run out of TIME still occupies the
  // slot. Close it here, or the studio is told to "withdraw it first" while the card
  // shows nothing to withdraw.
  const existing = await getLiveOfferForRequest(db, request.id)
  if (existing && offerState(existing, Date.now()) !== "live") {
    const closed = await updateOffer(db, existing.id, {
      closed_at: new Date().toISOString(),
    })
    // Falling through would trip the unique index and report "withdraw it
    // first" — the exact dead end this block exists to avoid.
    if (!closed.ok) {
      console.error(`[design] could not close lapsed offer ${existing.id}:`, closed.message)
      return { ok: false, error: "Couldn’t clear the previous offer — please try again." }
    }
  }

  const saved = await insertOffer(db, {
    client_id: request.client_id,
    request_id: request.id,
    name_en: nameEn,
    name_dk: input.nameDk?.trim() || null,
    duration_mins: Math.round(input.durationMins),
    price_cents: Math.round(input.priceCents),
    artist_note: note,
    expires_at: offerExpiryFrom(Date.now(), holdDays),
  })
  if (!saved.ok) {
    // The partial unique index is the guard: one live offer per request. Any
    // other failure is a real error and must not be reported as that.
    const duplicate = /duplicate key|unique constraint/i.test(saved.message)
    if (!duplicate) console.error("[design] offer insert failed:", saved.message)
    return {
      ok: false,
      error: duplicate
        ? "There's already a live offer on this request — withdraw it first."
        : "Couldn’t save the offer — please try again.",
    }
  }

  const answeredAt = new Date().toISOString()
  const marked = await updateDesignRequest(db, request.id, {
    status: "offered",
    answered_at: answeredAt,
  })
  // The offer row is the source of truth; status only drives the queue. Log a
  // failed flip rather than failing the send — but log it, because a request
  // stuck on `open` with a live offer refuses the next "Make an offer".
  if (!marked.ok) {
    console.error(`[design] offer ${saved.id} sent but request ${request.id} not marked offered:`, marked.message)
  }
  // An offer IS the studio answering, so it raises the client's banner too.
  // Its own write, so a missed stamp costs a banner and not the status flip.
  await stampArtistReply(db, request.id, answeredAt)

  const contact = (await fetchClientContacts([request.client_id]))[request.client_id]
  if (contact?.email) {
    const locale = contact.communicationLocale
    const res = await sendOfferEmail({
      to: contact.email,
      firstName: contact.firstName,
      locale,
      offerName: pickName(locale, nameEn, input.nameDk?.trim() || null),
      durationMins: Math.round(input.durationMins),
      priceCents: Math.round(input.priceCents),
      artistNote: note,
      expiresAt: offerExpiryFrom(Date.now(), holdDays),
      offerUrl: offerUrlFor(locale, saved.id),
    })
    await recordCommunication({
      clientId: request.client_id,
      bookingId: null,
      kind: "design_offer_sent",
      trigger: "manual",
      recipient: contact.email,
      status: statusFromEmailResult(res),
      error: res.error,
    })
  }

  revalidatePath(routes.admin.home)
  return { ok: true, id: saved.id }
}

/** Pull an offer back. The request returns to the queue so it can be re-offered. */
export async function withdrawOffer(offerId: string): Promise<OfferActionResult> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "Not authorized." }

  const offer = await getOffer(db, offerId)
  if (!offer) return { ok: false, error: "Offer not found." }
  if (offer.booking_id) return { ok: false, error: "That offer is already booked." }

  const now = new Date().toISOString()
  const done = await updateOffer(db, offerId, {
    withdrawn_at: now,
    // Frees the one-live-offer index so the studio can send a replacement.
    closed_at: now,
  })
  if (!done.ok) return { ok: false, error: "Couldn’t withdraw it — please try again." }

  const reopened = await updateDesignRequest(db, offer.request_id, {
    status: "open",
  })
  if (!reopened.ok) {
    console.error(`[design] offer ${offerId} withdrawn but request not reopened:`, reopened.message)
  }
  revalidatePath(routes.admin.home)
  return { ok: true }
}

/**
 * The client books their offer from the signed link. The token is the
 * authorization; the booking belongs to the offer's own client, whoever is
 * holding the link. A signed-in visitor who is someone ELSE is refused outright.
 */
export async function bookOfferByToken(input: {
  token: string
  start: string
  locale?: string
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const offerId = verifyOfferToken(input.token)
  if (!offerId) return { ok: false, error: "This link isn’t valid." }

  const user = await getCurrentUser()
  const db = createSupabaseServiceRoleClient()
  const offer = await getOffer(db, offerId)
  if (!offer) return { ok: false, error: "This offer no longer exists." }
  if (user && !user.isOwner && user.id !== offer.client_id) {
    return { ok: false, error: "This offer belongs to someone else." }
  }

  return bookOffer(db, offer, input.start, {
    locale: resolveLocale(input.locale),
    actor: "client",
    checkSlot: true,
  })
}

/**
 * The artist places the offer herself — the urgent path. Limits can be ignored
 * so an outside-hours repair can be slotted in; the overlap constraint still
 * holds.
 */
export async function bookOfferAsOwner(input: {
  offerId: string
  start: string
  ignoreLimits?: boolean
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "Not authorized." }

  const offer = await getOffer(db, input.offerId)
  if (!offer) return { ok: false, error: "Offer not found." }

  const contact = (await fetchClientContacts([offer.client_id]))[offer.client_id]
  return bookOffer(db, offer, input.start, {
    locale: contact?.communicationLocale ?? "da",
    actor: "studio",
    checkSlot: !input.ignoreLimits,
  })
}

/** The one path from a live offer to a real booking. */
async function bookOffer(
  db: Db,
  offer: OfferRow,
  start: string,
  opts: { locale: string; actor: "client" | "studio"; checkSlot: boolean },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const state = offerState(offer, Date.now())
  if (state !== "live") return { ok: false, error: `This offer is ${state}.` }

  const prepared = await buildBookingDraft(
    db,
    { ref: offerRef(offer.id), start, locale: opts.locale },
    { checkSlot: opts.checkSlot, ignoreLeadTime: opts.actor === "studio" },
  )
  if (!prepared.ok) return prepared
  const { draft } = prepared

  const result = await insertBooking(db, {
    client_id: offer.client_id,
    ...draft.values,
  })
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "overlap"
          ? "That time was just taken — please pick another."
          : "Couldn’t create the booking.",
    }
  }

  // Single use, enforced atomically: two people holding the same link and
  // picking DIFFERENT times both pass the liveness check above and both insert
  // (the overlap constraint only catches identical times). The compare-and-set
  // decides one winner; the loser's booking is cancelled rather than left behind.
  const claimed = await claimOfferForBooking(db, offer.id, result.id)
  if (!claimed) {
    const undone = await cancelBookingById(db, result.id)
    if (!undone.ok) {
      // Both bookings now stand. Loud, because only a human can reconcile it.
      console.error(
        `[design] LOST offer claim for ${offer.id} AND failed to cancel booking ${result.id}:`,
        undone.message,
      )
    }
    return { ok: false, error: "That offer was just booked — check My Space." }
  }
  const closed = await updateDesignRequest(db, offer.request_id, {
    status: "booked",
    closed_at: new Date().toISOString(),
  })
  if (!closed.ok) {
    console.error(`[design] booking ${result.id} made but request ${offer.request_id} not closed:`, closed.message)
  }

  const contact = (await fetchClientContacts([offer.client_id]))[offer.client_id]
  if (contact?.email) {
    const locale = contact.communicationLocale
    const { serviceName } = localizedBookingNames(
      metaOf({ selected_addons: draft.values.selected_addons }),
      locale,
    )
    const res = await sendBookingConfirmationEmail({
      to: contact.email,
      firstName: contact.firstName,
      serviceName,
      addonNames: [],
      startIso: start,
      endIso: draft.endIso,
      priceCents: offer.price_cents,
      manageUrl: manageUrlFor(locale, result.id),
      bookingId: result.id,
      actor: opts.actor,
      locale,
    })
    await recordCommunication({
      clientId: offer.client_id,
      bookingId: result.id,
      kind: "confirmation",
      trigger: opts.actor === "studio" ? "manual" : "auto",
      recipient: contact.email,
      status: statusFromEmailResult(res),
      error: res.error,
    })
  }

  revalidatePath(routes.admin.home)
  revalidatePath(routes.admin.appointments)
  revalidatePath(revalidatePatterns.publicAppointments, "page")
  return { ok: true, id: result.id }
}

/**
 * Housekeeping, run from the admin home: expire held-out offers, purge reference
 * photos past retention. THROTTLED to once an hour per process — the admin home
 * re-renders on every realtime change, and a Storage listing per render would
 * land in the artist's TTFB. A scheduled job is its proper home
 * (docs/tasks/in-house/SCHEDULER-OPTIONS.md).
 */
// Deliberately the IN-MEMORY limiter, unlike the upload and message limits.
// This throttles idempotent cleanup, not a client action: per-instance means it
// may run a few times an hour instead of once, which costs a little work and
// breaks nothing — and the alternative is a database round trip on every
// /admin render, which is what triggers it.
const housekeeping: RateLimitState = new Map()
const HOUSEKEEPING_RULE = { limit: 1, windowMs: 60 * 60 * 1000 }

export async function runDesignHousekeeping(limit = 50): Promise<{
  offersExpired: number
  refsPurged: number
}> {
  const idle = { offersExpired: 0, refsPurged: 0 }
  const db = await requireOwner()
  if (!db) return idle
  // Token AFTER the owner check, so a non-owner render can't spend the hour.
  if (!takeToken(housekeeping, "design", Date.now(), HOUSEKEEPING_RULE)) return idle

  const now = new Date().toISOString()
  const stale = await listExpiredLiveOffers(db, now, limit)
  for (const offer of stale) {
    // Close the OFFER as well as the request: the one-live-offer index keys off
    // `closed_at`, so leaving it open would block every future offer on this
    // request — while the request itself has left the queue.
    await updateOffer(db, offer.id, { closed_at: now })
    await updateDesignRequest(db, offer.request_id, {
      status: "expired",
      closed_at: now,
    })
  }
  const [refsPurged, orphansPurged] = await Promise.all([
    purgeExpiredDesignRefs(db, limit).catch((error) => {
      console.error("[design] ref purge failed", error)
      return 0
    }),
    purgeOrphanedRefObjects(db, { limit }).catch((error) => {
      console.error("[design] orphan sweep failed", error)
      return 0
    }),
    // Not design's business, but this is the only throttled sweep we have and
    // the rate-limit table has no other cleaner. Move both to the cron (D).
    purgeExpiredRateLimits(db).catch(() => 0),
  ])
  return { offersExpired: stale.length, refsPurged: refsPurged + orphansPurged }
}

const clampHold = (days: number | undefined) =>
  Number.isFinite(days)
    ? Math.min(MAX_HOLD_DAYS, Math.max(1, Math.round(days as number)))
    : OFFER_DEFAULT_DAYS

const pickName = (locale: string, en: string, dk: string | null) =>
  locale === "en" ? en : dk ?? en
