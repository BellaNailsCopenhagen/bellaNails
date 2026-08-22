"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { SlotPicker, type SlotPickerOutcome } from "@/components/booking/slot-picker"
import { rescheduleBookingAsOwner } from "@/modules/booking/actions"
import type { Slot } from "@/shared/booking-slots"
import { ADMIN_LOCALE } from "@/config/admin"

/**
 * Owner reschedule-on-behalf — the same in-house picker the client flow uses,
 * in the English-only admin. The server action re-verifies the owner role and
 * re-validates the slot; on success we return to the queue with a fresh render.
 */
export function AdminRescheduleSlotStep({
  id,
  slots,
  maxAdvanceDays,
}: {
  id: string
  slots: Slot[]
  maxAdvanceDays: number
}) {
  const router = useRouter()

  const onConfirm = async (start: string): Promise<SlotPickerOutcome> => {
    const result = await rescheduleBookingAsOwner(id, start)
    if (!result.ok) {
      return { ok: false, error: "Couldn’t move it — try another time." }
    }
    toast.success("Appointment moved")
    router.replace("/admin")
    router.refresh()
    return { ok: true }
  }

  return (
    <SlotPicker
      slots={slots}
      locale={ADMIN_LOCALE}
      onConfirm={onConfirm}
      labels={{
        chooseDate: "Choose a date",
        chooseTime: "Choose a time",
        empty: "No available times right now.",
        confirm: "Confirm new time",
        confirming: "Moving…",
        genericError: "Couldn’t move it — try another time.",
        advanceNote: `You can book up to ${maxAdvanceDays} days in advance.`,
        availableLegend: "Available",
        prevMonth: "Previous month",
        nextMonth: "Next month",
      }}
    />
  )
}
