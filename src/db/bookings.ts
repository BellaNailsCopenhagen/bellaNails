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
  "id, cal_booking_id, cal_uid, client_id, start_time, end_time, status, total_price_cents, selected_addons, client_notes, reschedule_url, cancel_url, no_show_at"

export type BookingRow = Pick<
  Row<"bookings">,
  | "id"
  | "cal_booking_id"
  | "cal_uid"
  | "client_id"
  | "start_time"
  | "end_time"
  | "status"
  | "total_price_cents"
  | "selected_addons"
  | "client_notes"
  | "reschedule_url"
  | "cancel_url"
  | "no_show_at"
>

/** Status + timing — what every eligibility check (cancel, reschedule,
    no-show) reads before deciding. */
export type BookingLifecycle = Pick<
  Row<"bookings">,
  "cal_uid" | "status" | "start_time"
>

// ---------------------------------------------------------------- reads

/** One booking's lifecycle state by Cal uid; null when there is no such row. */
export async function getBookingLifecycle(
  db: Db,
  uid: string,
): Promise<BookingLifecycle | null> {
  const { data } = await db
    .from("bookings")
    .select("cal_uid, status, start_time")
    .eq("cal_uid", uid)
    .maybeSingle()
  return data ?? null
}

/** Just the status, for a post-write confirmation read. */
export async function getBookingStatus(
  db: Db,
  uid: string,
): Promise<string | null> {
  const { data } = await db
    .from("bookings")
    .select("status")
    .eq("cal_uid", uid)
    .maybeSingle()
  return data?.status ?? null
}

/** Has the webhook written this booking yet? Backs the post-booking probe. */
export async function bookingExists(db: Db, uid: string): Promise<boolean> {
  const { data, error } = await db
    .from("bookings")
    .select("cal_uid")
    .eq("cal_uid", uid)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data)
}

export type BookingRecap = Pick<
  Row<"bookings">,
  "status" | "start_time" | "end_time" | "selected_addons"
>

/** The confirmation-page recap shape. */
export async function getBookingRecap(
  db: Db,
  uid: string,
): Promise<BookingRecap | null> {
  const { data, error } = await db
    .from("bookings")
    .select("status, start_time, end_time, selected_addons")
    .eq("cal_uid", uid)
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

/** Sync state keyed by Cal's numeric booking id (the webhook's identity). */
export async function getBookingSyncState(
  db: Db,
  calBookingId: number,
): Promise<Pick<Row<"bookings">, "cal_booking_id" | "status"> | null> {
  const { data } = await db
    .from("bookings")
    .select("cal_booking_id, status")
    .eq("cal_booking_id", calBookingId)
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
    .select("cal_booking_id", { count: "exact", head: true })
    .filter("selected_addons->>serviceId", "eq", serviceId)
    .in("status", [...ACTIVE_BOOKING_STATUSES])
    .is("no_show_at", null)
  return count ?? 0
}

// --------------------------------------------------------------- writes

export type BookingUpsert = Insert<"bookings">

/** Insert-or-update a booking keyed by Cal's numeric id. Returns the row id
    so the caller can hang related records (terms acceptance) off it. */
export async function upsertBooking(
  db: Db,
  values: BookingUpsert,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { data, error } = await db
    .from("bookings")
    .upsert(values, { onConflict: "cal_booking_id" })
    .select("id")
    .single()
  if (error) return { ok: false, message: error.message }
  return { ok: true, id: data.id }
}

/** Mark one booking cancelled by Cal uid. */
export async function cancelBookingByUid(
  db: Db,
  uid: string,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await db
    .from("bookings")
    .update({ status: BOOKING_STATUS.cancelled })
    .eq("cal_uid", uid)
  return error ? { ok: false, message: error.message } : { ok: true }
}

/** Mark cancelled by Cal's numeric id; returns how many rows matched so the
    webhook can tell "cancelled" from "we never had this booking". */
export async function cancelBookingByCalId(
  db: Db,
  calBookingId: number,
): Promise<{ ok: true; matched: number } | { ok: false; message: string }> {
  const { data, error } = await db
    .from("bookings")
    .update({ status: BOOKING_STATUS.cancelled })
    .eq("cal_booking_id", calBookingId)
    .select("cal_booking_id")
  if (error) return { ok: false, message: error.message }
  return { ok: true, matched: data?.length ?? 0 }
}

/** Close the booking a reschedule replaced — everything on that uid except
    the new row Cal just minted. */
export async function cancelSupersededBooking(
  db: Db,
  replacedUid: string,
  keepCalBookingId: number,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await db
    .from("bookings")
    .update({ status: BOOKING_STATUS.cancelled })
    .eq("cal_uid", replacedUid)
    .neq("cal_booking_id", keepCalBookingId)
  return error ? { ok: false, message: error.message } : { ok: true }
}

/** Set or clear the studio-side no-show marker. */
export async function setBookingNoShowAt(
  db: Db,
  uid: string,
  at: string | null,
): Promise<{ ok: boolean }> {
  const { error } = await db
    .from("bookings")
    .update({ no_show_at: at })
    .eq("cal_uid", uid)
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
