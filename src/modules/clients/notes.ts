import "server-only"

import { listClientLevelNotes } from "@/db/notes"
import { requireOwner } from "@/modules/identity/require-owner"
import { toNoteView, type NoteView } from "@/shared/notes"

/** A client's client-level notes (booking_id null) for their detail page.
    Owner-gated; degrades to []. */
export async function getClientNotes(clientId: string): Promise<NoteView[]> {
  const db = await requireOwner()
  if (!db) {
    return []
  }
  const rows = await listClientLevelNotes(db, [clientId]).catch(() => [])

  return rows.map(toNoteView)
}
