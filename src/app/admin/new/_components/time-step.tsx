"use client"

import { SlotPicker, type SlotPickerOutcome } from "@/components/booking/slot-picker"
import type { Slot } from "@/shared/booking-slots"
import { ADMIN_LOCALE } from "@/config/admin"

/**
 * Step 4 — the in-house picker (owner slots, no 24 h lead time). onConfirm owns
 * the createBookingAsOwner call + navigation; the picker just surfaces failure.
 */
export function TimeStep({ slots, maxAdvanceDays, onConfirm }: {
  slots: Slot[]
  maxAdvanceDays: number
  onConfirm: (start: string) => Promise<SlotPickerOutcome>
}) {
  return (
    <SlotPicker
      slots={slots}
      locale={ADMIN_LOCALE}
      onConfirm={onConfirm}
      labels={{
        chooseDate: "Choose a date",
        chooseTime: "Choose a time",
        empty: "No available times right now.",
        confirm: "Create booking",
        confirming: "Creating…",
        genericError: "Couldn’t create the booking — try another time.",
        advanceNote: `You can book up to ${maxAdvanceDays} days in advance.`,
        availableLegend: "Available",
        prevMonth: "Previous month",
        nextMonth: "Next month",
      }}
    />
  )
}
