"use client"

import * as React from "react"
import { X } from "lucide-react"
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
import { cardActionDestructive } from "@/components/admin/card-action"
import {
  cancelBookingAsOwner,
} from "@/modules/booking/actions"

/**
 * Owner cancel behind a confirm dialog. The server action re-verifies the owner
 * role and revalidates /admin on success (no 24 h policy for the studio). The
 * dialog stays open while pending so a double-tap can't fire twice.
 */
export function AdminCancelButton({
  id,
  clientName,
  when,
  service,
}: {
  id: string
  clientName: string
  /** Date + time, already formatted — with three bookings for one client on
      screen, the name alone made this dialog a coin flip. */
  when: string
  service: string
}) {
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  const confirm = () =>
    startTransition(async () => {
      try {
        const result = await cancelBookingAsOwner(id)
        if (result.ok) {
          toast.success("Appointment cancelled")
        } else {
          toast.error("Couldn’t cancel — please try again.")
        }
      } catch {
        // A thrown action must still resolve the UI, not leave it stuck.
        toast.error("Couldn’t cancel — please try again.")
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
      <AlertDialogTrigger
        render={<button type="button" className={cardActionDestructive()} />}
      >
        <X className="size-3.5" />
        Cancel
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
        <AlertDialogDescription>
          <span className="block font-medium text-foreground">
            {when} · {service}
          </span>
          {clientName}’s appointment will be cancelled and the time released.
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
