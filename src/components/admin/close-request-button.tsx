"use client"

import * as React from "react"
import { X } from "lucide-react"

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cardActionDestructive } from "@/components/admin/card-action"
import { useActionRunner } from "@/hooks/use-action-runner"
import { declineDesignRequest } from "@/modules/design/request-actions"
import { MAX_MESSAGE_LENGTH } from "@/shared/design"

/**
 * Closing a thread, behind a confirmation that spells out what it costs: the
 * client can't write back on it, and any live offer is withdrawn with it.
 *
 * The reason is required, not polite — it is posted into the thread and emailed,
 * so a closed conversation never goes quiet without saying why.
 */
export function CloseRequestButton({
  requestId,
  clientName,
  hasLiveOffer,
}: {
  requestId: string
  clientName: string
  hasLiveOffer: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [reason, setReason] = React.useState("")
  const { pending, run } = useActionRunner()

  const close = () =>
    run(async () => {
      const result = await declineDesignRequest(requestId, reason)
      if (result.ok) {
        setReason("")
        setOpen(false)
      }
      return result
    })

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) setOpen(next)
      }}
    >
      <AlertDialogTrigger
        render={<button type="button" className={cardActionDestructive()} />}
      >
        <X className="size-3.5" />
        Close
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>Close this conversation?</AlertDialogTitle>
        <AlertDialogDescription>
          {clientName} won’t be able to write back on it
          {hasLiveOffer ? ", and the open offer is withdrawn" : ""}. They get
          your reason by email and in My Space, and can always start a new
          conversation.
        </AlertDialogDescription>
        <div className="mt-4 space-y-2">
          <label
            htmlFor={`close-reason-${requestId}`}
            className="font-functional text-xs uppercase tracking-widest-lux text-muted-foreground"
          >
            Why are you closing it?
          </label>
          <Textarea
            id={`close-reason-${requestId}`}
            rows={3}
            maxLength={MAX_MESSAGE_LENGTH}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. This one needs more time than I can give it this season — write again in the new year and we'll plan it properly."
          />
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <AlertDialogClose
            render={<Button variant="ghost" size="sm" disabled={pending} />}
          >
            Keep it open
          </AlertDialogClose>
          <Button
            variant="destructive"
            size="sm"
            disabled={pending || !reason.trim()}
            onClick={close}
          >
            {pending ? "Closing…" : "Close & tell them"}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
