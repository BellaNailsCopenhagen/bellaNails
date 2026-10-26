"use client"

import * as React from "react"

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { BodySm, Eyebrow } from "@/components/ui/typography"
import { TruncatedText } from "@/components/ui/truncated-text"
import { useActionRunner } from "@/hooks/use-action-runner"
import { addNote, deleteNote, updateNote } from "@/modules/clients/note-actions"
import type { NoteView } from "@/shared/notes"
import { formatStudioDayMonthYear } from "@/shared/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"

const rowAction =
  "shrink-0 font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"

/**
 * A feed of artist notes for one scope (a client, or one booking). When
 * `editable`, one small text action on the right adds a note and each row opens
 * the same dialog to edit or delete it; otherwise it's read-only (the client's
 * notes shown on a booking card are edited from the client page).
 *
 * Writing happens in a dialog, not inline, for two reasons: a note is something
 * you READ before you act, so it should cost no vertical space when nobody is
 * writing one — and it is one gesture across both scopes, rather than the
 * artist learning a modal here and a growing textarea there. Owner-only.
 */
export function NoteFeed({
  title,
  notes,
  clientId,
  bookingId = null,
  editable = false,
  emptyLabel = "No notes yet.",
}: {
  title: string
  notes: NoteView[]
  clientId: string
  /** Set → notes attach to this booking; null → client-level notes. */
  bookingId?: string | null
  editable?: boolean
  emptyLabel?: string
}) {
  const { pending, run } = useActionRunner()
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState("")
  // The note being edited; null while writing a new one.
  const [editing, setEditing] = React.useState<NoteView | null>(null)

  const start = (note: NoteView | null) => {
    setEditing(note)
    setDraft(note?.body ?? "")
    setOpen(true)
  }

  const save = () =>
    run(async () => {
      const body = draft.trim()
      const result = editing
        ? await updateNote(editing.id, body)
        : await addNote({ clientId, bookingId, body })
      if (result.ok) {
        setOpen(false)
      }

      return result
    })

  const remove = () =>
    run(async () => {
      if (!editing) {
        return { ok: true }
      }
      const result = await deleteNote(editing.id)
      if (result.ok) {
        setOpen(false)
      }

      return result
    })

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow as="h3">{title}</Eyebrow>
        {editable ? (
          <button
            type="button"
            onClick={() => start(null)}
            className={rowAction}
          >
            Add
          </button>
        ) : null}
      </div>

      {notes.length ? (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li
              key={note.id}
              className="rounded-sm border border-border bg-background/50 p-2"
            >
              <TruncatedText text={note.body} />
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground">
                  {formatStudioDayMonthYear(
                    new Date(note.createdAt).getTime(),
                    ADMIN_LOCALE,
                  )}
                </span>
                {editable ? (
                  <button
                    type="button"
                    onClick={() => start(note)}
                    className={rowAction}
                  >
                    Edit
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <BodySm className="text-xs text-muted-foreground">{emptyLabel}</BodySm>
      )}

      {editable ? (
        <AlertDialog
          open={open}
          onOpenChange={(next) => {
            if (!pending) {
              setOpen(next)
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogTitle>
              {editing ? "Edit this note" : "Add a note"}
            </AlertDialogTitle>
            <div className="mt-4">
              <Textarea
                rows={5}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="e.g. Prefers a shorter file, and the cuticle oil without fragrance."
              />
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              {editing ? (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={pending}
                  onClick={remove}
                >
                  Delete
                </Button>
              ) : (
                <span />
              )}
              <div className="flex flex-wrap gap-3">
                <AlertDialogClose
                  render={
                    <Button variant="ghost" size="sm" disabled={pending} />
                  }
                >
                  Cancel
                </AlertDialogClose>
                <Button
                  size="sm"
                  disabled={pending || !draft.trim()}
                  onClick={save}
                >
                  Save
                </Button>
              </div>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </section>
  )
}
