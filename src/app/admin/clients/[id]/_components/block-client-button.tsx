"use client"

import * as React from "react"
import { Ban } from "lucide-react"

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { ConfirmActionButton } from "@/components/ui/confirm-action-button"
import { Input } from "@/components/ui/input"
import { BodySm } from "@/components/ui/typography"
import { cardActionDestructive } from "@/components/admin/card-action"
import { useActionRunner } from "@/hooks/use-action-runner"
import {
  blockIdentity,
  unblockIdentity,
} from "@/modules/booking/protection-actions"
import type { BlockedIdentityView } from "@/shared/booking-protection"

/**
 * Block this client from booking online, from their own page — which is where
 * you are when you decide it. The list under Clients → Blocked is for reviewing
 * and for the cases with no client row (a domain, an IP).
 *
 * Reversible on purpose, and it does not touch their history: a block is "no
 * more self-service", not erasure.
 */
export function BlockClientButton({
  email,
  clientName,
  block,
}: {
  /** Null when we have no address for them — nothing to block. */
  email: string | null
  clientName: string
  /** Their existing block, if any. */
  block: BlockedIdentityView | null
}) {
  const [open, setOpen] = React.useState(false)
  const [reason, setReason] = React.useState("")
  const { pending, run } = useActionRunner()

  if (!email) {
    return (
      <BodySm className="text-xs text-muted-foreground">
        No email on file, so there is nothing to block.
      </BodySm>
    )
  }

  if (block) {
    return (
      <div className="space-y-2">
        <BodySm className="text-xs text-muted-foreground">
          Blocked from booking online — “{block.reason}”
        </BodySm>
        <ConfirmActionButton
          action={() => unblockIdentity(block.id)}
          trigger={
            <button type="button" className={cardActionDestructive()}>
              Unblock
            </button>
          }
          labels={{
            title: `Let ${clientName} book again?`,
            body: "They will be able to book and send requests online as before. You can always block them again.",
            confirm: "Unblock",
            confirming: "Removing…",
            cancel: "Keep blocked",
            failed: "Couldn’t remove that.",
          }}
        />
      </div>
    )
  }

  const confirm = () =>
    run(async () => {
      const result = await blockIdentity({ kind: "email", value: email, reason })
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
        <Ban className="size-3.5" />
        Block from booking
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>Block {clientName} from booking?</AlertDialogTitle>
        <AlertDialogDescription>
          {email} can no longer book or send a request online. Their history and
          photos stay exactly as they are, you can still book them in yourself,
          and you can undo this whenever you like.
        </AlertDialogDescription>
        <div className="mt-4 space-y-2">
          <label
            htmlFor="block-reason"
            className="font-functional text-xs uppercase tracking-widest-lux text-muted-foreground"
          >
            Why?
          </label>
          <Input
            id="block-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Booked four times and never came, ignored two messages"
          />
          <BodySm className="text-xs">
            Required, and only you ever see it — you will want to know in six
            months.
          </BodySm>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <AlertDialogClose
            render={<Button variant="ghost" size="sm" disabled={pending} />}
          >
            Cancel
          </AlertDialogClose>
          <Button
            variant="destructive"
            size="sm"
            disabled={pending || !reason.trim()}
            onClick={confirm}
          >
            {pending ? "Blocking…" : "Block"}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
