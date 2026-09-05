"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"

import { useRouter } from "@/i18n/navigation"
import {
  SlotPicker,
  type SlotPickerOutcome,
} from "@/components/booking/slot-picker"
import { BookingRequestForm } from "@/app/[locale]/book/_components/booking-request-form"
import { Button } from "@/components/ui/button"
import {
  HumanCheck,
  type HumanCheckLabels,
} from "@/components/booking/human-check"
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
  signInReturnPath,
  humanLabels,
}: {
  serviceId: string
  addonIds: string[]
  slots: Slot[]
  maxAdvanceDays: number
  prefill: BookingContact
  outsideEnabled: boolean
  outsideSlots: Slot[]
  /** Where to return after sign-in if the session lapsed mid-flow. */
  signInReturnPath: string
  /** Null → the check is off (or unconfigured), so no box and no proof. */
  humanLabels: HumanCheckLabels | null
}) {
  const t = useTranslations("booking")
  const locale = useLocale()
  const router = useRouter()
  const [capStart, setCapStart] = useState<string | null>(null)
  const [showOutside, setShowOutside] = useState(false)
  // Null until the box is ticked. The server decides whether it is required —
  // the flag lives there — so this is sent as-is either way.
  const [humanProof, setHumanProof] = useState<string | null>(null)

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
      email: prefill.email,
      phone: prefill.phone,
      notes: prefill.notes,
      locale,
      honeypot: prefill.honeypot,
      humanProof: humanProof ?? undefined,
    })
    if (!result.ok) {
      // Cap reached → offer to send this exact time as a request. Report success
      // to the picker (it stays put, no error) so the request form below reads as
      // the next step, not a failure.
      if (result.code === "cap") {
        setCapStart(start)
        return { ok: true }
      }
      // A spent or missing proof: clear it so ticking again mints a fresh one.
      if (result.code === "human") {
        setHumanProof(null)
        return { ok: false, error: result.error }
      }
      // A session that lapsed between the details step and this tap — send them
      // to sign in and straight back to the time they had chosen.
      if (result.code === "auth") {
        router.push({
          pathname: routes.signIn,
          query: { next: signInReturnPath },
        })
        return { ok: false, error: result.error }
      }
      return { ok: false, error: result.error }
    }
    router.replace({ pathname: routes.confirmation, query: { id: result.id } })
    return { ok: true }
  }

  return (
    <div className="space-y-6">
      {/* Above the calendar on purpose: it is a step, and it should be done
          before the tap that actually books. */}
      {humanLabels ? (
        <HumanCheck
          labels={humanLabels}
          proof={humanProof}
          onSolved={setHumanProof}
        />
      ) : null}

      <SlotPicker
        slots={slots}
        locale={locale}
        onConfirm={onConfirm}
        labels={slotLabels}
      />

      {capStart ? (
        <BookingRequestForm
          signInReturnPath={signInReturnPath}
          humanProof={humanProof}
          onProofSpent={() => setHumanProof(null)}
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
            signInReturnPath={signInReturnPath}
            humanProof={humanProof}
            onProofSpent={() => setHumanProof(null)}
            serviceId={serviceId}
            addonIds={addonIds}
            prefill={prefill}
            kind="outside_hours"
            slots={outsideSlots}
            slotLabels={outsideLabels}
          />
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowOutside(true)}
          >
            {locale === "en"
              ? "Can't find a time? Request one outside our hours"
              : "Finder du ikke et tidspunkt? Anmod om en tid uden for åbningstiden"}
          </Button>
        )
      ) : null}
    </div>
  )
}
