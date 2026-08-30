"use server"

import { revalidatePath } from "next/cache"

import {
  deleteNote as deleteNoteRow,
  insertNote,
  updateNoteBody,
} from "@/db/notes"
import { requireOwner } from "@/modules/identity/require-owner"
import { routes, revalidatePatterns } from "@/shared/routes"

export type NoteResult = { ok: true } | { ok: false; error: string }

// Notes surface on every admin booking card + the client page — refresh them all.
function revalidateNoteSurfaces(): void {
  revalidatePath(routes.admin.home)
  revalidatePath(routes.admin.agenda)
  revalidatePath(routes.admin.appointments)
  revalidatePath(revalidatePatterns.adminClient, "page")
}

/** Add a note on a client (bookingId null) or a booking. Owner-only. */
export async function addNote(input: {
  clientId: string
  bookingId: string | null
  body: string
}): Promise<NoteResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }
  const body = input.body.trim()
  if (!body) return { ok: false, error: "Write something first." }

  const saved = await insertNote(supabase, {
    client_id: input.clientId,
    booking_id: input.bookingId,
    body,
  })
  if (!saved.ok) return { ok: false, error: "Couldn’t save the note." }

  revalidateNoteSurfaces()
  return { ok: true }
}

export async function updateNote(id: string, body: string): Promise<NoteResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }
  const trimmed = body.trim()
  if (!trimmed) return { ok: false, error: "Write something first." }

  const saved = await updateNoteBody(supabase, id, trimmed)
  if (!saved.ok) return { ok: false, error: "Couldn’t save the note." }

  revalidateNoteSurfaces()
  return { ok: true }
}

export async function deleteNote(id: string): Promise<NoteResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const removed = await deleteNoteRow(supabase, id)
  if (!removed.ok) return { ok: false, error: "Couldn’t remove the note." }

  revalidateNoteSurfaces()
  return { ok: true }
}
