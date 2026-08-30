"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"

import { useRouter } from "@/i18n/navigation"
import { SlotPicker, type SlotPickerOutcome } from "@/components/booking/slot-picker"
import { BookingRequestForm } from "@/app/[locale]/book/_components/booking-request-form"
import { Button } from "@/components/ui/button"
import { createBooking } from "@/modules/booking/create-booking-actions"
import type { Slot } from "@/shared/booking-slots"
import type { BookingContact } from "@/shared/contact-validation"
import { routes } from "@/config/routes"

/**
 * BookingSlotStep — the confirm step's in-house picker (replaces the Cal embed).
 * On success createBooking returns the row id and we replace-navigate to
 * /confirmation. When the flow can't grant a slot, it offers a REQUEST instead of
 * a dead end: hitting the 2-active cap surfaces an over-limit request for the
 * picked time; and (when the studio enables it) a client can request a time
 * outside the normal hours from a calendar of those slots.
 */
export function BookingSlotStep({
  serviceId,
  addonIds,
  slots,
  maxAdvanceDays,
  prefill,
  outsideEnabled,
  outsideSlots,
}: {
  serviceId: string
  addonIds: string[]
  slots: Slot[]
  maxAdvanceDays: number
  prefill: BookingContact
  outsideEnabled: boolean
  outsideSlots: Slot[]
}) {
  const t = useTranslations("booking")
  const locale = useLocale()
  const router = useRouter()
  const [capStart, setCapStart] = useState<string | null>(null)
  const [showOutside, setShowOutside] = useState(false)

  // One label set — shared by the normal picker and the outside-hours request one.
  const slotLabels = {
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
  }

  // The outside-hours picker sends a REQUEST, not a booking — override the
  // confirm/advance wording so it never reads as a confirmed reservation.
  const outsideLabels = {
    ...slotLabels,
    confirm: locale === "en" ? "Send request" : "Send anmodning",
    confirming: locale === "en" ? "Sending…" : "Sender…",
    advanceNote:
      locale === "en"
        ? "These times are outside our normal hours — not guaranteed."
        : "Disse tider er uden for normal åbningstid — ikke garanteret.",
  }

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
      honeypot: prefill.honeypot,
    })
    if (!result.ok) {
      // Cap reached → offer to send this exact time as a request. Report success
      // to the picker (it stays put, no error) so the request form below reads as
      // the next step, not a failure.
      if (result.code === "cap") {
        setCapStart(start)
        return { ok: true }
      }
      return { ok: false, error: result.error }
    }
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
    <div className="space-y-6">
      <SlotPicker
        slots={slots}
        locale={locale}
        onConfirm={onConfirm}
        labels={slotLabels}
      />

      {capStart ? (
        <BookingRequestForm
          key={capStart}
          serviceId={serviceId}
          addonIds={addonIds}
          prefill={prefill}
          kind="over_limit"
          fixedStart={capStart}
        />
      ) : outsideEnabled ? (
        showOutside ? (
          <BookingRequestForm
            serviceId={serviceId}
            addonIds={addonIds}
            prefill={prefill}
            kind="outside_hours"
            slots={outsideSlots}
            slotLabels={outsideLabels}
          />
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setShowOutside(true)}>
            {locale === "en"
              ? "Can't find a time? Request one outside our hours"
              : "Finder du ikke et tidspunkt? Anmod om en tid uden for åbningstiden"}
          </Button>
        )
      ) : null}
    </div>
  )
}
