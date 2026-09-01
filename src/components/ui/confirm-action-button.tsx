"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

export type ConfirmLabels = {
  title: string
  body: string
  confirm: string
  confirming: string
  cancel: string
  failed: string
}

// Small red "only touch if you mean to" pill — the shared trigger style for the
// destructive withdraw / delete actions this button guards.
export const withdrawPill =
  "self-start rounded-full border border-destructive/40 px-2.5 py-1 font-functional text-[0.625rem] uppercase tracking-widest-lux text-destructive/80 transition-colors hover:border-destructive hover:text-destructive"

// The reversible counterpart to withdrawPill — a quiet underline, not a pill,
// so undoing never looks heavier than the destructive action it undoes.
export const restoreLink =
  "self-start font-functional text-xs uppercase tracking-widest-lux text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground disabled:opacity-50"

/**
 * Confirm-then-run for a destructive client action (delete, withdraw sharing).
 * The caller supplies the styled trigger, the labels (for localization), and
 * the server action. Dialog stays open while pending so a double-tap can't fire
 * twice; refreshes on success.
 */
export function ConfirmActionButton({
  action,
  trigger,
  labels,
}: {
  action: () => Promise<{ ok: boolean; error?: string }>
  trigger: React.ReactElement
  labels: ConfirmLabels
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  const confirm = () =>
    startTransition(async () => {
      try {
        const result = await action()
        if (result.ok) router.refresh()
        else toast.error(result.error || labels.failed)
      } catch {
        toast.error(labels.failed)
      } finally {
        setOpen(false)
      }
    })

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) setOpen(next)
      }}
    >
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogTitle>{labels.title}</AlertDialogTitle>
        <AlertDialogDescription>{labels.body}</AlertDialogDescription>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <AlertDialogClose
            render={<Button variant="ghost" size="sm" disabled={pending} />}
          >
            {labels.cancel}
          </AlertDialogClose>
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={confirm}
          >
            {pending ? labels.confirming : labels.confirm}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
