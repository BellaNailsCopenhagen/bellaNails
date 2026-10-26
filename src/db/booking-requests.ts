import type { Db, Insert, Row, Update } from "./client"

/** `booking_requests` — a client's ask for a slot the self-service flow won't
    grant (outside hours, or past the 2-active cap). The artist accepts (→ a real
    booking) or rejects. Service-role writes; RLS lets the owner read all and a
    client read their own. */

export type BookingRequestRow = Row<"booking_requests">

export async function insertBookingRequest(
  db: Db,
  values: Insert<"booking_requests">,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { data, error } = await db
    .from("booking_requests")
    .insert(values)
    .select("id")
    .single()
  if (error || !data) {
    return { ok: false, message: error?.message ?? "no row" }
  }

  return { ok: true, id: data.id }
}

/** Pending requests for the admin section, oldest first (act on the earliest). */
export async function listPendingBookingRequests(
  db: Db,
): Promise<BookingRequestRow[]> {
  const { data } = await db
    .from("booking_requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })

  return data ?? []
}

export async function countPendingBookingRequests(db: Db): Promise<number> {
  const { count } = await db
    .from("booking_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")

  return count ?? 0
}

/** How many undecided requests one client is holding — the per-client cap.
    Distinct from `countPendingBookingRequests`, which is the artist's whole
    queue. */
export async function countPendingBookingRequestsForClient(
  db: Db,
  clientId: string,
): Promise<number> {
  const { count, error } = await db
    .from("booking_requests")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("status", "pending")
  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
}

/** One request by id — the accept/reject path reads it (and re-checks status). */
export async function getBookingRequest(
  db: Db,
  id: string,
): Promise<BookingRequestRow | null> {
  const { data } = await db
    .from("booking_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  return data ?? null
}

export async function updateBookingRequest(
  db: Db,
  id: string,
  values: Update<"booking_requests">,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await db
    .from("booking_requests")
    .update(values)
    .eq("id", id)

  return error ? { ok: false, message: error.message } : { ok: true }
}

/** A client's own requests — the DSAR export. */
export async function listBookingRequestsForClient(
  db: Db,
  clientId: string,
): Promise<BookingRequestRow[]> {
  const { data } = await db
    .from("booking_requests")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })

  return data ?? []
}

/** GDPR erasure — the `message` is client free-text (PII) and a request is
    ephemeral (the accepted booking is retained anonymized), so delete outright. */
export async function deleteBookingRequestsForClient(
  db: Db,
  clientId: string,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await db
    .from("booking_requests")
    .delete()
    .eq("client_id", clientId)

  return error ? { ok: false, message: error.message } : { ok: true }
}
