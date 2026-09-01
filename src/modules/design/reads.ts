import "server-only"

import { listDesignMessagesForRequests } from "@/db/design-messages"
import { listDesignRefsForRequests } from "@/db/design-refs"
import {
  listActionableDesignRequests,
  countActionableDesignRequests,
  listDesignRequestsForClient,
  type DesignRequestRow,
} from "@/db/design-requests"
import { getOffer, listLiveOffersForRequests } from "@/db/offers"
import type { DesignMessageRow } from "@/db/design-messages"
import type { DesignRefRow } from "@/db/design-refs"
import type { OfferRow } from "@/db/offers"
import type { Db } from "@/db/client"
import { fetchClientContacts } from "@/modules/clients"
import type { ClientContact } from "@/shared/contact"
import { getCurrentUser } from "@/modules/identity/server"
import { requireOwner } from "@/modules/identity/require-owner"
import { signOfferToken, verifyOfferToken } from "@/modules/design/offer-token"
import { signedViewUrl, storageConfigured } from "@/platform/storage/supabase"
import {
  createAuthedSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/platform/supabase/server"
import { offerState, type OfferState } from "@/shared/offer"
import {
  asDesignStatus,
  asDesignTopic,
  type DesignStatus,
  type DesignTopic,
} from "@/shared/design"

/**
 * Everything a design-request surface renders, composed here so a page asks one
 * question. Reference photos live in a private bucket, so each one is resolved
 * to a short-lived signed URL; without storage configured they simply don't
 * render rather than taking the page down.
 */

export type DesignRefView = { id: string; url: string }

export type DesignMessageView = {
  id: string
  author: "client" | "artist"
  body: string
  createdAt: string
}

export type DesignOfferView = {
  id: string
  nameEn: string
  nameDk: string | null
  durationMins: number
  priceCents: number
  artistNote: string | null
  expiresAt: string
  state: OfferState
}

export type DesignRequestView = {
  id: string
  clientId: string
  topic: DesignTopic
  status: DesignStatus
  preferredWindow: string | null
  bookingId: string | null
  createdAt: string
  messages: DesignMessageView[]
  /** Signed for display — PRUNED: empty without storage, and a ref whose URL
      won't sign is dropped rather than rendered broken. */
  refs: DesignRefView[]
  /** How many refs actually exist. Never derive the cap from `refs.length`. */
  refCount: number
  offer: DesignOfferView | null
}

function toOfferView(offer: OfferRow, now: number): DesignOfferView {
  return {
    id: offer.id,
    nameEn: offer.name_en,
    nameDk: offer.name_dk,
    durationMins: offer.duration_mins,
    priceCents: offer.price_cents,
    artistNote: offer.artist_note,
    expiresAt: offer.expires_at,
    state: offerState(offer, now),
  }
}

/** Sign every private ref in one pass; a ref that won't sign is dropped rather
    than rendered as a broken image. */
async function signRefs(rows: DesignRefRow[]): Promise<Map<string, DesignRefView[]>> {
  const byRequest = new Map<string, DesignRefView[]>()
  if (!storageConfigured()) return byRequest

  const signed = await Promise.all(
    rows.map(async (row) => {
      const result = await signedViewUrl(row.storage_key)
      return result.ok
        ? { requestId: row.request_id, view: { id: row.id, url: result.data.url } }
        : null
    }),
  )
  for (const item of signed) {
    if (!item) continue
    byRequest.set(item.requestId, [
      ...(byRequest.get(item.requestId) ?? []),
      item.view,
    ])
  }
  return byRequest
}

function groupMessages(rows: DesignMessageRow[]): Map<string, DesignMessageView[]> {
  const byRequest = new Map<string, DesignMessageView[]>()
  for (const row of rows) {
    byRequest.set(row.request_id, [
      ...(byRequest.get(row.request_id) ?? []),
      {
        id: row.id,
        author: row.author === "artist" ? "artist" : "client",
        body: row.body,
        createdAt: row.created_at,
      },
    ])
  }
  return byRequest
}

/** Compose rows + their children into views. One query per child table. */
async function composeRequests(
  db: Db,
  rows: DesignRequestRow[],
  now: number,
): Promise<DesignRequestView[]> {
  if (!rows.length) return []
  const ids = rows.map((r) => r.id)
  const [messages, refs, offers] = await Promise.all([
    listDesignMessagesForRequests(db, ids),
    listDesignRefsForRequests(db, ids),
    listLiveOffersForRequests(db, ids),
  ])
  const messagesBy = groupMessages(messages)
  const refCounts = new Map<string, number>()
  for (const ref of refs) {
    refCounts.set(ref.request_id, (refCounts.get(ref.request_id) ?? 0) + 1)
  }
  const refsBy = await signRefs(refs)
  const offerBy = new Map(offers.map((o) => [o.request_id, o]))

  return rows.map((row) => {
    const offer = offerBy.get(row.id)
    return {
      id: row.id,
      clientId: row.client_id,
      topic: asDesignTopic(row.topic),
      status: asDesignStatus(row.status),
      preferredWindow: row.preferred_window,
      bookingId: row.booking_id,
      createdAt: row.created_at,
      messages: messagesBy.get(row.id) ?? [],
      refs: refsBy.get(row.id) ?? [],
      refCount: refCounts.get(row.id) ?? 0,
      offer: offer ? toOfferView(offer, now) : null,
    }
  })
}

/**
 * The artist's queue — every request still needing her, oldest first, with the
 * contacts to reach each client. Mirrors `getPendingRequests` so the admin home
 * renders both queues the same way. Returns empty for a non-owner and degrades
 * to empty on a read failure rather than taking the home screen down.
 */
export async function getOpenDesignRequests(now: number = Date.now()): Promise<{
  requests: DesignRequestView[]
  contacts: Record<string, ClientContact>
}> {
  const empty = { requests: [], contacts: {} }
  const db = await requireOwner()
  if (!db) return empty
  try {
    const rows = await listActionableDesignRequests(db)
    if (!rows.length) return empty
    const [requests, contacts] = await Promise.all([
      composeRequests(db, rows, now),
      fetchClientContacts(rows.map((r) => r.client_id)),
    ])
    return { requests, contacts }
  } catch (error) {
    console.error("[design] queue load failed", errorMessage(error))
    return empty
  }
}

/** Badge count for the command centre. */
export async function getOpenDesignRequestCount(): Promise<number> {
  const db = await requireOwner()
  if (!db) return 0
  return countActionableDesignRequests(db).catch(() => 0)
}

/**
 * The signed-in client's own requests, newest first, plus the signed token for
 * each live offer — minted here so My Space links to the very same URL the
 * offer email does, and there is one route to maintain rather than two.
 */
export async function getMyDesignRequests(now: number = Date.now()): Promise<{
  requests: DesignRequestView[]
  offerTokens: Record<string, string>
}> {
  const empty = { requests: [], offerTokens: {} }
  const user = await getCurrentUser()
  if (!user) return empty
  try {
    const db = await createAuthedSupabaseServerClient()
    const requests = await composeRequests(
      db,
      await listDesignRequestsForClient(db, user.id),
      now,
    )
    const offerTokens: Record<string, string> = {}
    for (const request of requests) {
      if (request.offer?.state === "live") {
        offerTokens[request.offer.id] = signOfferToken(request.offer.id)
      }
    }
    return { requests, offerTokens }
  } catch (error) {
    console.error("[design] my requests load failed", errorMessage(error))
    return empty
  }
}

export type OfferPageData = {
  offerId: string
  clientId: string
  nameEn: string
  nameDk: string | null
  durationMins: number
  priceCents: number
  artistNote: string | null
  expiresAt: string
  state: OfferState
  refs: DesignRefView[]
}

/**
 * The offer behind a signed link. The token IS the authorization — it is
 * verified here and the offer's own `client_id` decides who the booking belongs
 * to. Returns null only for a bad signature or a vanished offer; a withdrawn,
 * used or expired offer still resolves, so the page can explain itself.
 */
export async function getOfferByToken(
  token: string,
  now: number = Date.now(),
): Promise<OfferPageData | null> {
  const offerId = verifyOfferToken(token)
  if (!offerId) return null

  const db = createSupabaseServiceRoleClient()
  const offer = await getOffer(db, offerId).catch(() => null)
  if (!offer) return null

  const refsBy = await signRefs(await listDesignRefsForRequests(db, [offer.request_id]))
  return {
    offerId: offer.id,
    clientId: offer.client_id,
    nameEn: offer.name_en,
    nameDk: offer.name_dk,
    durationMins: offer.duration_mins,
    priceCents: offer.price_cents,
    artistNote: offer.artist_note,
    expiresAt: offer.expires_at,
    state: offerState(offer, now),
    refs: refsBy.get(offer.request_id) ?? [],
  }
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : error
