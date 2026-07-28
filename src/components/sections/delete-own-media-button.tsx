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
import { deleteOwnMedia } from "@/lib/actions/client-media"

/**
 * Confirm-then-delete for a client's own media — deletion is destructive (real
 * erasure, incl. any published copy), so it's always behind this dialog. The
 * trigger is supplied by the caller so each surface styles its own control;
 * labels are passed in so callers own localization. Dialog stays open while
 * pending so a double-tap can't fire twice.
 */
export function DeleteOwnMediaButton({
  mediaId,
  trigger,
  labels,
}: {
  mediaId: string
  trigger: React.ReactElement
  labels: {
    title: string
    body: string
    confirm: string
    confirming: string
    cancel: string
    failed: string
  }
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  const confirm = () =>
    startTransition(async () => {
      try {
        const result = await deleteOwnMedia(mediaId)
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
