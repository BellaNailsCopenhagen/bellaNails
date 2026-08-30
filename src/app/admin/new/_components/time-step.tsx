"use client"

import { SlotPicker, type SlotPickerOutcome } from "@/components/booking/slot-picker"
import { OVERRIDE_WINDOW_LABEL, type Slot } from "@/shared/booking-slots"
import { ADMIN_LOCALE } from "@/config/admin"

/**
 * Step 4 — the in-house picker (owner slots, no 24 h lead time). onConfirm owns
 * the createBookingAsOwner call + navigation; the picker just surfaces failure.
 */
export function TimeStep({ slots, maxAdvanceDays, onConfirm, override }: {
  slots: Slot[]
  maxAdvanceDays: number
  onConfirm: (start: string) => Promise<SlotPickerOutcome>
  /** "Ignore all limits" mode — same picker, but the slots are the override set
      (any day, hours ignored, taken slots removed) so the note must say so. */
  override?: boolean
}) {
  return (
    <SlotPicker
      slots={slots}
      locale={ADMIN_LOCALE}
      onConfirm={onConfirm}
      labels={{
        chooseDate: "Choose a date",
        chooseTime: "Choose a time",
        empty: override
          ? "No free times left in the override window."
          : "No available times right now.",
        confirm: "Create booking",
        confirming: "Creating…",
        genericError: "Couldn’t create the booking — try another time.",
        advanceNote: override
          ? `Working hours & days off ignored (${OVERRIDE_WINDOW_LABEL}) — only taken slots are hidden.`
          : `You can book up to ${maxAdvanceDays} days in advance.`,
        availableLegend: "Available",
        prevMonth: "Previous month",
        nextMonth: "Next month",
      }}
    />
  )
}
