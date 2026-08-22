"use client"

import { useLocale, useTranslations } from "next-intl"

import { useRouter } from "@/i18n/navigation"
import { SlotPicker, type SlotPickerOutcome } from "@/components/booking/slot-picker"
import { createBooking } from "@/modules/booking/create-booking-actions"
import type { Slot } from "@/shared/booking-slots"
import type { BookingContact } from "@/shared/contact-validation"
import { routes } from "@/config/routes"

/**
 * BookingSlotStep — the confirm step's in-house picker (replaces the Cal embed).
 * The /book gate guarantees a complete contact before this renders; on success
 * createBooking returns the row id and we replace-navigate to /confirmation so
 * back can't resurface the armed confirm step.
 */
export function BookingSlotStep({
  serviceId,
  addonIds,
  slots,
  maxAdvanceDays,
  prefill,
}: {
  serviceId: string
  addonIds: string[]
  slots: Slot[]
  maxAdvanceDays: number
  prefill: BookingContact
}) {
  const t = useTranslations("booking")
  const locale = useLocale()
  const router = useRouter()

  const onConfirm = async (start: string): Promise<SlotPickerOutcome> => {
    const result = await createBooking({
      serviceId,
      addonIds,
      start,
      name: prefill.name ?? "",
      email: prefill.email ?? "",
      phone: prefill.phone,
      notes: prefill.notes,
      locale,
    })
    if (!result.ok) return { ok: false, error: result.error }
    router.replace({
      pathname: routes.confirmation,
      query: {
        id: result.id,
        ...(prefill.email ? { email: prefill.email } : {}),
      },
    })
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
        empty: t("noTimes"),
        confirm: t("confirmCta"),
        confirming: t("securingBooking"),
        genericError: t("bookingError"),
        advanceNote: t("advanceNote", { days: maxAdvanceDays }),
        availableLegend: t("availableLegend"),
        prevMonth: t("prevMonth"),
        nextMonth: t("nextMonth"),
      }}
    />
  )
}
