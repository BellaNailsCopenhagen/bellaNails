"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { BodySm, Eyebrow } from "@/components/ui/typography"
import { TruncatedText } from "@/components/ui/truncated-text"
import { useActionRunner } from "@/hooks/use-action-runner"
import { addNote, deleteNote, updateNote } from "@/modules/clients/note-actions"
import type { NoteView } from "@/shared/notes"
import { formatStudioDayMonthYear } from "@/shared/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"

const textarea =
  "w-full rounded-sm border border-border bg-background p-2 font-functional text-sm text-foreground"
const rowAction =
  "font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"

/**
 * A feed of artist notes for one scope (a client or a booking). When `editable`,
 * the artist can add / edit / delete entries; otherwise it's read-only (e.g. the
 * client's notes shown on a booking card, edited from the client page). Owner-only.
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
  const [draft, setDraft] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState("")

  const add = () => {
    const body = draft.trim()
    if (!body) return
    run(async () => {
      const res = await addNote({ clientId, bookingId, body })
      if (res.ok) setDraft("")
      return res
    })
  }

  const saveEdit = (id: string) => {
    const body = editText.trim()
    if (!body) return
    run(async () => {
      const res = await updateNote(id, body)
      if (res.ok) setEditingId(null)
      return res
    })
  }

  return (
    <section className="space-y-2">
      <Eyebrow as="h3">{title}</Eyebrow>

      {notes.length ? (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li
              key={n.id}
              className="rounded-sm border border-border bg-background/50 p-2"
            >
              {editable && editingId === n.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                    className={textarea}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={pending} onClick={() => saveEdit(n.id)}>
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <TruncatedText text={n.body} />
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground">
                      {formatStudioDayMonthYear(
                        new Date(n.createdAt).getTime(),
                        ADMIN_LOCALE,
                      )}
                    </span>
                    {editable ? (
                      <span className="flex shrink-0 gap-3">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            setEditingId(n.id)
                            setEditText(n.body)
                          }}
                          className={rowAction}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run(() => deleteNote(n.id))}
                          className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-destructive/70 transition-colors hover:text-destructive"
                        >
                          Delete
                        </button>
                      </span>
                    ) : null}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <BodySm className="text-xs text-muted-foreground">{emptyLabel}</BodySm>
      )}

      {editable ? (
        <div className="space-y-1.5">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="Add a note…"
            className={textarea}
          />
          <Button size="sm" disabled={pending || !draft.trim()} onClick={add}>
            Add note
          </Button>
        </div>
      ) : null}
    </section>
  )
}
