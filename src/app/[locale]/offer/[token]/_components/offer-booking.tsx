"use client"

import { useTranslations } from "next-intl"

import { useRouter } from "@/i18n/navigation"

import { SlotPicker } from "@/components/booking/slot-picker"
import { Eyebrow } from "@/components/ui/typography"
import { bookOfferByToken } from "@/modules/design/offer-actions"
import type { Slot } from "@/shared/booking-slots"
import { routes } from "@/config/routes"

/**
 * The time half of the offer page. Deliberately the SAME picker (and the same
 * booking-namespace copy) as /book: an offer is booked exactly like a service,
 * so it should look and behave exactly like one.
 */
export function OfferBooking({
  token,
  locale,
  slots,
  maxAdvanceDays,
}: {
  token: string
  locale: string
  slots: Slot[]
  maxAdvanceDays: number
}) {
  const t = useTranslations("booking")
  const tOffer = useTranslations("offer")
  const router = useRouter()

  const confirm = async (start: string) => {
    const result = await bookOfferByToken({ token, start, locale })
    if (!result.ok) return { ok: false as const, error: result.error }
    router.push({
      pathname: routes.confirmation,
      query: { booking: result.id },
    })
    return { ok: true as const }
  }

  return (
    <div className="space-y-5">
      <Eyebrow>{tOffer("chooseTime")}</Eyebrow>
      <SlotPicker
        slots={slots}
        locale={locale}
        onConfirm={confirm}
        labels={{
          chooseDate: t("pickDateLabel"),
          chooseTime: t("pickTimeLabel"),
          empty: tOffer("noTimes"),
          confirm: tOffer("confirm"),
          confirming: tOffer("confirming"),
          genericError: tOffer("failed"),
          advanceNote: t("advanceNote", { days: maxAdvanceDays }),
          availableLegend: t("availableLegend"),
          prevMonth: t("prevMonth"),
          nextMonth: t("nextMonth"),
        }}
      />
    </div>
  )
}
