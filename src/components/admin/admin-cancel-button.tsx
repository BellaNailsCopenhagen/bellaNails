"use client"

import * as React from "react"
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
import { cancelBookingAsOwner } from "@/lib/actions/cancel-booking-admin"

/**
 * Owner cancel behind a confirm dialog. The server action re-verifies the owner
 * role and revalidates /admin on success (no 24 h policy for the studio). The
 * dialog stays open while pending so a double-tap can't fire twice.
 */
export function AdminCancelButton({
  uid,
  clientName,
}: {
  uid: string
  clientName: string
}) {
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  const confirm = () =>
    startTransition(async () => {
      try {
        const result = await cancelBookingAsOwner(uid)
        if (result.ok) {
          toast.success("Appointment cancelled")
        } else {
          toast.error(
            "Couldn’t cancel — try again, or cancel from the Cal dashboard.",
          )
        }
      } catch {
        // A thrown action must still resolve the UI, not leave it stuck.
        toast.error(
          "Couldn’t cancel — try again, or cancel from the Cal dashboard.",
        )
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
      <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
        Cancel
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
        <AlertDialogDescription>
          {clientName}’s appointment will be cancelled and they’ll be notified.
          This can’t be undone.
        </AlertDialogDescription>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <AlertDialogClose
            render={<Button variant="ghost" size="sm" disabled={pending} />}
          >
            Keep it
          </AlertDialogClose>
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={confirm}
          >
            {pending ? "Cancelling…" : "Cancel appointment"}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
