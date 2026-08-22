"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
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
import { Separator } from "@/components/ui/separator"
import { TintedCard } from "@/components/ui/tinted-card"
import { BodySm } from "@/components/ui/typography"
import { SlotPicker, type SlotPickerOutcome } from "@/components/booking/slot-picker"
import {
  cancelBookingByToken,
  rescheduleBookingByToken,
} from "@/modules/booking/actions"
import type { Slot } from "@/shared/booking-slots"

/**
 * Guest self-service — reschedule (the shared calendar picker) or cancel, both
 * authorized by the signed token from the email link. `manageable` is the
 * server's 24 h-policy verdict; inside the window we show the studio notice.
 * On success we swap to an inline confirmation (there's no account to return to).
 */
export function ManageBooking({
  token,
  manageable,
  slots,
  maxAdvanceDays,
}: {
  token: string
  manageable: boolean
  slots: Slot[]
  maxAdvanceDays: number
}) {
  const t = useTranslations("bookings")
  const locale = useLocale()
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const [done, setDone] = React.useState<"cancelled" | "moved" | null>(null)

  if (done) {
    return (
      <TintedCard>
        <BodySm>{done === "cancelled" ? t("cancelDone") : t("rescheduleDone")}</BodySm>
      </TintedCard>
    )
  }

  if (!manageable) {
    return (
      <TintedCard>
        <BodySm>{t("noticePolicy")}</BodySm>
      </TintedCard>
    )
  }

  const onReschedule = async (start: string): Promise<SlotPickerOutcome> => {
    const result = await rescheduleBookingByToken(token, start)
    if (!result.ok) {
      return {
        ok: false,
        error:
          result.error === "within_policy"
            ? t("within24h")
            : t("rescheduleFailed"),
      }
    }
    setDone("moved")
    return { ok: true }
  }

  const confirmCancel = () =>
    startTransition(async () => {
      try {
        const result = await cancelBookingByToken(token)
        if (result.ok) setDone("cancelled")
        else if (result.error === "within_policy") toast.error(t("within24h"))
        else toast.error(t("cancelFailed"))
      } catch {
        // A thrown action must still resolve the UI, not leave it stuck.
        toast.error(t("cancelFailed"))
      } finally {
        setOpen(false)
      }
    })

  return (
    <div className="space-y-8">
      <SlotPicker
        slots={slots}
        locale={locale}
        onConfirm={onReschedule}
        labels={{
          chooseDate: t("pickDateLabel"),
          chooseTime: t("pickTimeLabel"),
          empty: t("rescheduleNoTimes"),
          confirm: t("rescheduleConfirm"),
          confirming: t("rescheduling"),
          genericError: t("rescheduleFailed"),
          advanceNote: t("advanceNote", { days: maxAdvanceDays }),
          availableLegend: t("availableLegend"),
          prevMonth: t("prevMonth"),
          nextMonth: t("nextMonth"),
        }}
      />

      <Separator />

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next)
        }}
      >
        <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
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
              onClick={confirmCancel}
            >
              {pending ? t("cancelling") : t("cancelConfirmCta")}
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
