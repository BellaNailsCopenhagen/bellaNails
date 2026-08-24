import { ACTIVE_BOOKING_STATUSES, BOOKING_STATUS } from "@/shared/booking-status"

import type { Db, Insert, Row } from "./client"

/**
 * `bookings` table access. Every query against the table lives here, so the
 * column list and the soft-state filters have exactly one definition.
 * Client-safe — RLS scopes the rows; authorization is the caller's job.
 */

/** The columns booking displays render — select exactly these. `client_id`
    is the client's identity key (not PII); the admin queue resolves it to
    name/phone/email via the clients table, the client list simply ignores it. */
const BOOKING_COLUMNS =
  "id, client_id, start_time, end_time, status, total_price_cents, selected_addons, client_notes, no_show_at"

export type BookingRow = Pick<
  Row<"bookings">,
  | "id"
  | "client_id"
  | "start_time"
  | "end_time"
  | "status"
  | "total_price_cents"
  | "selected_addons"
  | "client_notes"
  | "no_show_at"
>

/** What every manage action (cancel, reschedule, no-show) reads before
    deciding: status + timing for the policy check, client_id for ownership,
    and selected_addons so a reschedule can recompute availability. */
export type BookingManageState = Pick<
  Row<"bookings">,
  "status" | "start_time" | "end_time" | "client_id" | "selected_addons"
>

// ---------------------------------------------------------------- reads

/** One booking's manage state by row id; null when there is no such row (or
    RLS hides it — the caller reads it as "not yours"). */
export async function getBookingForManage(
  db: Db,
  id: string,
): Promise<BookingManageState | null> {
  const { data } = await db
    .from("bookings")
    .select("status, start_time, end_time, client_id, selected_addons")
    .eq("id", id)
    .maybeSingle()
  return data ?? null
}

export type BookingRecap = Pick<
  Row<"bookings">,
  "status" | "start_time" | "end_time" | "selected_addons"
>

/** The confirmation-page recap shape, by row id. */
export async function getBookingRecap(
  db: Db,
  id: string,
): Promise<BookingRecap | null> {
  const { data, error } = await db
    .from("bookings")
    .select("status, start_time, end_time, selected_addons")
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ?? null
}

/** Owner + booked product of one booking by row id — the media uploader
    verifies the booking belongs to the client before linking an image. */
export async function getBookingOwner(
  db: Db,
  bookingId: string,
): Promise<Pick<Row<"bookings">, "id" | "client_id" | "selected_addons"> | null> {
  const { data } = await db
    .from("bookings")
    .select("id, client_id, selected_addons")
    .eq("id", bookingId)
    .maybeSingle()
  return data ?? null
}

/** Every booking for one client, newest first. Both the client's own list and
    the admin client detail read this — same rows, different RLS. */
export async function listBookingsForClient(
  db: Db,
  clientId: string,
): Promise<BookingRow[]> {
  const { data, error } = await db
    .from("bookings")
    .select(BOOKING_COLUMNS)
    .eq("client_id", clientId)
    .order("start_time", { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

/** A client's next active bookings (soonest first) — the home-page card. */
export async function listUpcomingBookingsForClient(
  db: Db,
  clientId: string,
  nowIso: string,
  limit: number,
): Promise<BookingRow[]> {
  const { data, error } = await db
    .from("bookings")
    .select(BOOKING_COLUMNS)
    .eq("client_id", clientId)
    .in("status", [...ACTIVE_BOOKING_STATUSES])
    .gt("end_time", nowIso)
    .order("start_time", { ascending: true })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data ?? []
}

/** Active bookings not yet finished — the admin queue. */
export async function listActiveBookingsFrom(
  db: Db,
  nowIso: string,
): Promise<BookingRow[]> {
  const { data, error } = await db
    .from("bookings")
    .select(BOOKING_COLUMNS)
    .in("status", [...ACTIVE_BOOKING_STATUSES])
    .gte("end_time", nowIso)
    .order("start_time", { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

/** How many active (upcoming, non-cancelled) bookings a client currently holds —
    backs the public booking cap ("hands + feet" = 2 at a time). */
export async function countActiveUpcomingBookingsForClient(
  db: Db,
  clientId: string,
  nowIso: string,
): Promise<number> {
  const { count, error } = await db
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .in("status", [...ACTIVE_BOOKING_STATUSES])
    .gte("end_time", nowIso)
  if (error) throw new Error(error.message)
  return count ?? 0
}

/** Every booking not yet finished, any status — admin agenda "upcoming". */
export async function listBookingsFrom(
  db: Db,
  nowIso: string,
): Promise<BookingRow[]> {
  const { data, error } = await db
    .from("bookings")
    .select(BOOKING_COLUMNS)
    .gte("end_time", nowIso)
    .order("start_time", { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

/** Finished bookings, newest first — admin agenda "past". */
export async function listBookingsBefore(
  db: Db,
  nowIso: string,
  limit: number,
): Promise<BookingRow[]> {
  const { data, error } = await db
    .from("bookings")
    .select(BOOKING_COLUMNS)
    .lt("end_time", nowIso)
    .order("start_time", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data ?? []
}

export type BookingSpan = Pick<
  Row<"bookings">,
  "client_id" | "start_time" | "end_time"
>

export type TimeSpan = Pick<Row<"bookings">, "start_time" | "end_time">

/** Active bookings whose window overlaps [startIso, endIso) — the slot
    generator subtracts these (plus a buffer) from availability. */
export async function listActiveBookingSpansBetween(
  db: Db,
  startIso: string,
  endIso: string,
): Promise<TimeSpan[]> {
  const { data, error } = await db
    .from("bookings")
    .select("start_time, end_time")
    .in("status", [...ACTIVE_BOOKING_STATUSES])
    .lt("start_time", endIso)
    .gt("end_time", startIso)
  if (error) throw new Error(error.message)
  return data ?? []
}

/** Every booking reduced to client + window — the admin client directory
    aggregates visit counts and last-seen from this. */
export async function listBookingSpans(db: Db): Promise<BookingSpan[]> {
  const { data, error } = await db
    .from("bookings")
    .select("client_id, start_time, end_time")
    .order("start_time", { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

/** Batch client_id → no-show count in one query; absent = zero. */
export async function countNoShowsByClient(
  db: Db,
  clientIds: (string | null | undefined)[],
): Promise<Record<string, number>> {
  const ids = [...new Set(clientIds.filter((id): id is string => Boolean(id)))]
  if (ids.length === 0) return {}

  const { data, error } = await db
    .from("bookings")
    .select("client_id")
    .in("client_id", ids)
    .not("no_show_at", "is", null)
  if (error) throw new Error(error.message)

  const counts: Record<string, number> = {}
  for (const { client_id } of data ?? []) {
    counts[client_id] = (counts[client_id] ?? 0) + 1
  }
  return counts
}

/** How many active, attended bookings reference this service — the archive
    guard reads it so a service in use can't silently vanish. */
export async function countActiveBookingsForService(
  db: Db,
  serviceId: string,
): Promise<number> {
  const { count } = await db
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .filter("selected_addons->>serviceId", "eq", serviceId)
    .in("status", [...ACTIVE_BOOKING_STATUSES])
    .is("no_show_at", null)
  return count ?? 0
}

// --------------------------------------------------------------- writes

/** The `bookings_no_overlap` exclusion constraint code — a chosen time that
    collides with an active booking. Surfaced as `reason: "overlap"` so callers
    ask for another time instead of showing a raw DB error. */
function overlapError(error: { code?: string; message: string }): boolean {
  return (
    error.code === "23P01" || /exclu|overlap|no_overlap/i.test(error.message)
  )
}

/** Insert a fresh in-house booking. */
export async function insertBooking(
  db: Db,
  values: Insert<"bookings">,
): Promise<
  | { ok: true; id: string }
  | { ok: false; reason: "overlap" | "error"; message: string }
> {
  const { data, error } = await db
    .from("bookings")
    .insert(values)
    .select("id")
    .single()
  if (error) {
    return {
      ok: false,
      reason: overlapError(error) ? "overlap" : "error",
      message: error.message,
    }
  }
  return { ok: true, id: data.id }
}

/** Mark one booking cancelled by row id. `.select()` so a 0-row update (an
    RLS-blocked write, or a gone row) fails loudly instead of reading as ok. */
export async function cancelBookingById(
  db: Db,
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  const { data, error } = await db
    .from("bookings")
    .update({ status: BOOKING_STATUS.cancelled })
    .eq("id", id)
    .select("id")
  if (error) return { ok: false, message: error.message }
  return data.length > 0 ? { ok: true } : { ok: false, message: "no rows updated" }
}

/** Move one booking to a new window (status → rescheduled). Guards the overlap
    race the same way insert does; the row can't collide with itself. Clears any
    no-show mark — a moved booking is live again (no-op if it was never marked). */
export async function rescheduleBookingById(
  db: Db,
  id: string,
  startIso: string,
  endIso: string,
): Promise<
  { ok: true } | { ok: false; reason: "overlap" | "error"; message: string }
> {
  const { data, error } = await db
    .from("bookings")
    .update({
      start_time: startIso,
      end_time: endIso,
      status: BOOKING_STATUS.rescheduled,
      no_show_at: null,
    })
    .eq("id", id)
    .select("id")
  if (error) {
    return {
      ok: false,
      reason: overlapError(error) ? "overlap" : "error",
      message: error.message,
    }
  }
  // A 0-row update (RLS-blocked or gone) must not read as success.
  if (data.length === 0) {
    return { ok: false, reason: "error", message: "no rows updated" }
  }
  return { ok: true }
}

/** Set or clear the studio-side no-show marker, by row id. */
export async function setBookingNoShowAt(
  db: Db,
  id: string,
  at: string | null,
): Promise<{ ok: boolean }> {
  const { error } = await db
    .from("bookings")
    .update({ no_show_at: at })
    .eq("id", id)
  return { ok: !error }
}

/** Drop the free-text notes on every booking of one client (GDPR erasure). */
export async function clearClientNotes(
  db: Db,
  clientId: string,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await db
    .from("bookings")
    .update({ client_notes: null })
    .eq("client_id", clientId)
  return error ? { ok: false, message: error.message } : { ok: true }
}
