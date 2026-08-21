"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
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
import {
  cancelBooking,
} from "@/modules/booking/actions"

/**
 * CancelBookingButton — in-app cancel behind a confirm dialog. The server
 * action re-verifies ownership and the 24 h policy; the page revalidates on
 * success. The dialog stays open while pending so a double-tap can't fire
 * twice.
 */
export function CancelBookingButton({
  id,
  disabled = false,
}: {
  id: string
  disabled?: boolean
}) {
  const t = useTranslations("bookings")
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  const confirm = () =>
    startTransition(async () => {
      try {
        const result = await cancelBooking(id)
        if (result.ok) {
          toast.success(t("cancelDone"))
        } else if (result.error === "within_policy") {
          // Retrying can never succeed inside the window — point at the studio.
          toast.error(t("within24h"))
        } else {
          toast.error(t("cancelFailed"))
        }
      } catch {
        // A thrown action must still resolve the UI, not leave it stuck.
        toast.error(t("cancelFailed"))
      } finally {
        setOpen(false)
      }
    })

  return (
    // Esc/backdrop can't dismiss mid-flight — the dialog resolves only when
    // the action does.
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) setOpen(next)
      }}
    >
      <AlertDialogTrigger
        render={<Button variant="destructive" size="sm" disabled={disabled} />}
      >
        {t("cancel")}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>{t("cancelConfirm")}</AlertDialogTitle>
        <AlertDialogDescription>{t("cancelDialogBody")}</AlertDialogDescription>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <AlertDialogClose
            render={<Button variant="ghost" size="sm" disabled={pending} />}
          >
            {t("cancelKeep")}
          </AlertDialogClose>
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={confirm}
          >
            {pending ? t("cancelling") : t("cancelConfirmCta")}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
