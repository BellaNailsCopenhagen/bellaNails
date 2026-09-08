import "server-only"

import { countNoShowsByClient, type BookingRow } from "@/db/bookings"
import type { Db } from "@/db/client"
import { listReleasesForBookings } from "@/db/media-releases"
import {
  listClientLevelNotes,
  listNotesForBookings,
  type NoteRow,
} from "@/db/notes"
import { fetchClientContacts } from "@/modules/clients/contacts"
import type { ClientContact } from "@/shared/contact"
import { groupReleasesByBooking } from "@/shared/media-release"
import { toNoteView, type NoteView } from "@/shared/notes"
import { ADMIN_LOCALE } from "@/config/admin"
import { toDisplayBookings } from "./booking-view"
import type { DisplayBooking } from "@/shared/booking-view"
import { requireOwner } from "@/modules/identity/require-owner"

// Group note rows by a chosen key into NoteViews (feed order preserved).
function groupNotes(
  rows: NoteRow[],
  key: (r: NoteRow) => string | null,
): Map<string, NoteView[]> {
  const map = new Map<string, NoteView[]>()
  for (const row of rows) {
    const k = key(row)
    if (!k) continue
    const list = map.get(k) ?? []
    list.push(toNoteView(row))
    map.set(k, list)
  }
  return map
}

/**
 * Resolve booking rows for an admin list: names (catalog), contacts (the
 * clients table — name, email, phone), and no-show counts, fetched in parallel
 * and degrading independently. `context` labels failure logs by surface.
 */
export async function resolveAdminBookings(
  supabase: Db,
  rows: BookingRow[],
  context: string,
): Promise<{
  bookings: DisplayBooking[]
  contacts: Record<string, ClientContact>
  noShowCounts: Record<string, number>
}> {
  const bookingIds = rows.map((row) => row.id)
  const clientIds = rows.map((row) => row.client_id)
  // Notes are owner-only (RLS denies the authed client), so they need
  // service-role — but ask for it through the gate rather than assuming the
  // surface was gated. Null just means no notes, which every caller degrades
  // around already.
  const noteDb = await requireOwner()
  const [
    bookings,
    contacts,
    noShowCounts,
    releaseRows,
    bookingNoteRows,
    clientNoteRows,
  ] = await Promise.all([
    toDisplayBookings(supabase, rows, ADMIN_LOCALE, context),
    fetchClientContacts(clientIds),
    countNoShowsByClient(supabase, clientIds).catch((error) => {
      console.error(
        `[${context}] no-show reputation failed`,
        error instanceof Error ? error.message : error,
      )
      return {}
    }),
    listReleasesForBookings(supabase, bookingIds).catch(() => []),
    // Notes degrade independently — a missing table, or a caller that turns
    // out not to be the owner, never takes the list down.
    noteDb ? listNotesForBookings(noteDb, bookingIds).catch(() => []) : [],
    noteDb ? listClientLevelNotes(noteDb, clientIds).catch(() => []) : [],
  ])

  // Attach the media-release state + artist notes per booking (a booking shows its
  // own notes plus the client's client-level notes).
  const releasesByBooking = groupReleasesByBooking(releaseRows)
  const bookingNotes = groupNotes(bookingNoteRows, (r) => r.booking_id)
  const clientNotes = groupNotes(clientNoteRows, (r) => r.client_id)
  const resolved = bookings.map((b) => ({
    ...b,
    releases: releasesByBooking.get(b.row.id) ?? [],
    notes: {
      booking: bookingNotes.get(b.row.id) ?? [],
      client: clientNotes.get(b.row.client_id) ?? [],
    },
  }))

  return { bookings: resolved, contacts, noShowCounts }
}
