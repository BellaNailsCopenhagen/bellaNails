import type { Db, Row } from "./client"

/** `notes` — private artist notes on a client (booking_id null) or a booking.
    Owner-only (RLS denies clients); read/written via the service-role client. */

export type NoteRow = Row<"notes">

/** Booking-level notes for a set of bookings, oldest first (feed order). */
export async function listNotesForBookings(
  db: Db,
  bookingIds: string[],
): Promise<NoteRow[]> {
  if (!bookingIds.length) return []
  const { data } = await db
    .from("notes")
    .select("*")
    .in("booking_id", bookingIds)
    .order("created_at", { ascending: true })
  return data ?? []
}

/** Client-LEVEL notes (booking_id null) for a set of clients, oldest first. */
export async function listClientLevelNotes(
  db: Db,
  clientIds: string[],
): Promise<NoteRow[]> {
  if (!clientIds.length) return []
  const { data } = await db
    .from("notes")
    .select("*")
    .in("client_id", clientIds)
    .is("booking_id", null)
    .order("created_at", { ascending: true })
  return data ?? []
}

export type NoteInsert = {
  client_id: string
  booking_id: string | null
  body: string
}

export async function insertNote(
  db: Db,
  values: NoteInsert,
): Promise<{ ok: boolean; id?: string }> {
  const { data, error } = await db
    .from("notes")
    .insert(values)
    .select("id")
    .single()
  return { ok: !error, id: data?.id }
}

export async function updateNoteBody(
  db: Db,
  id: string,
  body: string,
): Promise<{ ok: boolean }> {
  const { error } = await db
    .from("notes")
    .update({ body, updated_at: new Date().toISOString() })
    .eq("id", id)
  return { ok: !error }
}

export async function deleteNote(db: Db, id: string): Promise<{ ok: boolean }> {
  const { error } = await db.from("notes").delete().eq("id", id)
  return { ok: !error }
}

/** Remove every note about a client (both levels) — used by GDPR erasure. */
export async function deleteNotesForClient(
  db: Db,
  clientId: string,
): Promise<{ ok: boolean }> {
  const { error } = await db.from("notes").delete().eq("client_id", clientId)
  return { ok: !error }
}
