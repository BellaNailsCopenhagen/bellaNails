"use client"

import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"

import { useRouter } from "@/i18n/navigation"
import {
  SlotPicker,
  type SlotPickerOutcome,
} from "@/components/booking/slot-picker"
import { rescheduleBooking } from "@/modules/booking/actions"
import type { Slot } from "@/shared/booking-slots"
import { routes } from "@/config/routes"

/**
 * RescheduleSlotStep — the client's in-house reschedule picker. On success the
 * server action re-verifies ownership + the 24 h policy and re-validates the
 * slot; we then return to /appointments with a fresh render.
 */
export function RescheduleSlotStep({
  id,
  slots,
  maxAdvanceDays,
}: {
  id: string
  slots: Slot[]
  maxAdvanceDays: number
}) {
  const t = useTranslations("bookings")
  const locale = useLocale()
  const router = useRouter()

  const onConfirm = async (start: string): Promise<SlotPickerOutcome> => {
    const result = await rescheduleBooking(id, start)
    if (!result.ok) {
      return {
        ok: false,
        error:
          result.error === "within_policy"
            ? t("within24h")
            : t("rescheduleFailed"),
      }
    }
    toast.success(t("rescheduleDone"))
    router.replace(routes.appointments)
    // Bust the client cache — /appointments was likely just visited.
    router.refresh()

    return { ok: true }
  }

  return (
    <SlotPicker
      slots={slots}
      locale={locale}
      onConfirm={onConfirm}
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
  )
}
