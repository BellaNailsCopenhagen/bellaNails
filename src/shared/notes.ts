// Client-safe note view model + its mapper. Client components (the note feed)
// render it, so it lives in shared/ — no vendor / service / UI imports.

import type { NoteRow } from "@/db/notes"

export type NoteView = {
  id: string
  body: string
  createdAt: string
  clientId: string
  /** null = a client-level note (shown on every one of that client's bookings). */
  bookingId: string | null
}

export function toNoteView(row: NoteRow): NoteView {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    clientId: row.client_id,
    bookingId: row.booking_id,
  }
}
