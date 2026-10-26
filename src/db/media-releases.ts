import type { ReleasePurpose } from "@/shared/media-release"

import type { Db, Insert, Row, Update } from "./client"

/** `media_releases` — booking-level permission to use a client's media for a
    purpose (website / social / education). One row per (booking, purpose): the
    client's documented, withdrawable consent. The per-asset published copy lives
    in `assets`; placement in `asset_usages`. Reads throw on a real error; callers
    degrade. */

export type { ReleasePurpose }
export type ReleaseStatus = "requested" | "granted" | "declined" | "withdrawn"

export type ReleaseRow = Row<"media_releases">

export type ReleaseStateRow = Pick<
  Row<"media_releases">,
  "booking_id" | "purpose" | "status"
>

/** Every release on a set of bookings — the client gallery + admin hub group by
    booking to show each appointment's consent state. */
export async function listReleasesForBookings(
  db: Db,
  bookingIds: string[],
): Promise<ReleaseStateRow[]> {
  const ids = [...new Set(bookingIds.filter(Boolean))]
  if (ids.length === 0) {
    return []
  }
  const { data } = await db
    .from("media_releases")
    .select("booking_id, purpose, status")
    .in("booking_id", ids)

  return data ?? []
}

/** A client's own releases — the My Space per-booking view and the data export.
    Deliberately unbounded: My Space builds its list from the BOOKINGS and looks
    each purpose up in here, so a truncated read doesn't shorten the page, it
    mislabels a granted permission as never asked. The rows are small and RLS
    scopes them to one person. */
export async function listReleasesForClient(
  db: Db,
  clientId: string,
): Promise<
  Pick<
    Row<"media_releases">,
    | "id"
    | "booking_id"
    | "purpose"
    | "status"
    | "consent_version"
    | "granted_at"
    | "withdrawn_at"
  >[]
> {
  const { data, error } = await db
    .from("media_releases")
    .select(
      "id, booking_id, purpose, status, consent_version, granted_at, withdrawn_at",
    )
    .eq("client_id", clientId)
    .order("requested_at", { ascending: false })
  // Throws rather than degrades: an empty result here is indistinguishable from
  // "never asked", so a swallowed failure would tell a client their live
  // permission was never given — and drop every release from a GDPR export.
  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

/** The release row for one (booking, purpose), with its owner — every decision
    authorizes against this. */
export async function findRelease(
  db: Db,
  bookingId: string,
  purpose: ReleasePurpose,
): Promise<Pick<Row<"media_releases">, "id" | "client_id" | "status"> | null> {
  const { data } = await db
    .from("media_releases")
    .select("id, client_id, status")
    .eq("booking_id", bookingId)
    .eq("purpose", purpose)
    .maybeSingle()

  return data ?? null
}

/** Which of these bookings are GRANTED for a purpose — the publish/placement
    gate ("may the artist publish this booking's media for `purpose`"). */
export async function listGrantedReleaseBookings(
  db: Db,
  bookingIds: string[],
  purpose: ReleasePurpose,
): Promise<string[]> {
  const ids = [...new Set(bookingIds.filter(Boolean))]
  if (ids.length === 0) {
    return []
  }
  const { data } = await db
    .from("media_releases")
    .select("booking_id")
    .eq("purpose", purpose)
    .eq("status", "granted")
    .in("booking_id", ids)

  return [...new Set((data ?? []).map((r) => r.booking_id))]
}

/** Is one booking granted for a purpose — the single-publish gate. */
export async function isBookingReleased(
  db: Db,
  bookingId: string,
  purpose: ReleasePurpose,
): Promise<boolean> {
  const { data } = await db
    .from("media_releases")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("purpose", purpose)
    .eq("status", "granted")
    .maybeSingle()

  return Boolean(data)
}

/** Pending-request count — the requests badge. */
export async function countRequestedReleasesForClient(
  db: Db,
  clientId: string,
): Promise<number> {
  const { count } = await db
    .from("media_releases")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("status", "requested")

  return count ?? 0
}

export type ReleaseUpsert = Insert<"media_releases">

/** Request a release (owner) — upsert on (booking_id, purpose), resetting prior
    decision timestamps so a re-request starts clean. */
export async function upsertReleases(
  db: Db,
  values: ReleaseUpsert[],
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await db
    .from("media_releases")
    .upsert(values, { onConflict: "booking_id,purpose" })

  return error ? { ok: false, message: error.message } : { ok: true }
}

/** Record a release that does not exist yet — the client offering an
    appointment nobody asked about. INSERT, never upsert: the unique
    (booking_id, purpose) is what guarantees a prior decision can't be
    overwritten, and a check-then-upsert leaves a window where it can. */
export async function insertRelease(
  db: Db,
  value: ReleaseUpsert,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await db.from("media_releases").insert(value)

  return error ? { ok: false, message: error.message } : { ok: true }
}

export async function updateRelease(
  db: Db,
  id: string,
  values: Update<"media_releases">,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await db.from("media_releases").update(values).eq("id", id)

  return error ? { ok: false, message: error.message } : { ok: true }
}
