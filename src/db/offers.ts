import type { Db, Insert, Row, Update } from "./client"

/** `offers` — the studio's one-time answer to a design request: a duration and
    price set for that job, reached by a signed token and booked like a service.
    A partial unique index guarantees at most ONE live offer per request. */

export type OfferRow = Row<"offers">

export async function insertOffer(
  db: Db,
  values: Insert<"offers">,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { data, error } = await db
    .from("offers")
    .insert(values)
    .select("id")
    .single()
  if (error || !data) {
    return { ok: false, message: error?.message ?? "no row" }
  }

  return { ok: true, id: data.id }
}

export async function getOffer(db: Db, id: string): Promise<OfferRow | null> {
  const { data } = await db
    .from("offers")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  return data ?? null
}

/** The one offer a request is currently waiting on — neither closed nor used. */
export async function getLiveOfferForRequest(
  db: Db,
  requestId: string,
): Promise<OfferRow | null> {
  const { data } = await db
    .from("offers")
    .select("*")
    .eq("request_id", requestId)
    .is("closed_at", null)
    .is("booking_id", null)
    .maybeSingle()

  return data ?? null
}

/** Live offers across a set of requests — the admin queue in one query. */
export async function listLiveOffersForRequests(
  db: Db,
  requestIds: string[],
): Promise<OfferRow[]> {
  if (!requestIds.length) {
    return []
  }
  const { data } = await db
    .from("offers")
    .select("*")
    .in("request_id", requestIds)
    .is("closed_at", null)
    .is("booking_id", null)

  return data ?? []
}

export async function updateOffer(
  db: Db,
  id: string,
  values: Update<"offers">,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await db.from("offers").update(values).eq("id", id)

  return error ? { ok: false, message: error.message } : { ok: true }
}

/** A client's own offers — My Space, and the DSAR export. */
export async function listOffersForClient(
  db: Db,
  clientId: string,
): Promise<OfferRow[]> {
  const { data } = await db
    .from("offers")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })

  return data ?? []
}

/** Live offers that have run out of time — the sweep closes their requests. */
export async function listExpiredLiveOffers(
  db: Db,
  nowIso: string,
  limit: number,
): Promise<OfferRow[]> {
  const { data } = await db
    .from("offers")
    .select("*")
    .is("closed_at", null)
    .is("booking_id", null)
    .lt("expires_at", nowIso)
    // Oldest first, so a backlog larger than `limit` drains instead of the sweep
    // re-reading the same page forever.
    .order("expires_at", { ascending: true })
    .limit(limit)

  return data ?? []
}

/**
 * Claim an offer for a booking, atomically. The `is("booking_id", null)` guard
 * makes this a compare-and-set: two concurrent bookings of the same offer race
 * here, and exactly one wins. Returns false for the loser.
 */
export async function claimOfferForBooking(
  db: Db,
  offerId: string,
  bookingId: string,
): Promise<boolean> {
  const { data } = await db
    .from("offers")
    .update({ booking_id: bookingId, closed_at: new Date().toISOString() })
    .eq("id", offerId)
    .is("booking_id", null)
    .is("closed_at", null)
    .select("id")

  return (data?.length ?? 0) > 0
}
