"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { SlotPicker, type SlotPickerOutcome } from "@/components/booking/slot-picker"
import { BodySm } from "@/components/ui/typography"
import { rescheduleBookingAsOwner } from "@/modules/booking/actions"
import { getOwnerOverrideSlotsForBooking } from "@/modules/booking/actions"
import { OVERRIDE_WINDOW_LABEL, type Slot } from "@/shared/booking-slots"
import { routes } from "@/shared/routes"
import { ADMIN_LOCALE } from "@/config/admin"

const BASE_LABELS = {
  chooseDate: "Choose a date",
  chooseTime: "Choose a time",
  confirm: "Confirm new time",
  confirming: "Moving…",
  genericError: "Couldn’t move it — try another time.",
  availableLegend: "Available",
  prevMonth: "Previous month",
  nextMonth: "Next month",
}

/**
 * Owner reschedule-on-behalf — the same in-house picker the client flow uses, in
 * the English-only admin. "Ignore hours & days off" swaps in the override slots
 * (any day, hours ignored, taken slots still excluded) and moves free of the
 * availability check; the server re-verifies the owner + the overlap constraint.
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
  const [ignoreLimits, setIgnoreLimits] = useState(false)
  const [overrideSlots, setOverrideSlots] = useState<Slot[] | null>(null)

  const onConfirm = async (start: string): Promise<SlotPickerOutcome> => {
    const result = await rescheduleBookingAsOwner(id, start, { ignoreLimits })
    if (!result.ok) {
      return { ok: false, error: "Couldn’t move it — try another time." }
    }
    toast.success("Appointment moved")
    router.replace(routes.admin.home)
    router.refresh()
    return { ok: true }
  }

  // Toggle "ignore limits" → lazy-load the override slots (any day, hours
  // ignored, existing bookings still excluded).
  const toggleIgnore = (next: boolean) => {
    setIgnoreLimits(next)
    if (next && overrideSlots === null) {
      getOwnerOverrideSlotsForBooking(id)
        .then(setOverrideSlots)
        // A load failure must read as an error, not as "no times available".
        .catch(() => {
          setOverrideSlots([])
          toast.error("Couldn’t load times — try again.")
        })
    }
  }

  return (
    <div className="space-y-5">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={ignoreLimits}
          onChange={(e) => toggleIgnore(e.target.checked)}
          className="size-4"
        />
        <span className="font-functional text-sm text-foreground">
          Ignore hours &amp; days off — pick any free slot
        </span>
      </label>

      {ignoreLimits && overrideSlots === null ? (
        <BodySm>Loading times…</BodySm>
      ) : (
        <SlotPicker
          // Remount on toggle so a stale day/time can't survive the switch.
          key={ignoreLimits ? "override" : "normal"}
          slots={ignoreLimits ? (overrideSlots ?? []) : slots}
          locale={ADMIN_LOCALE}
          onConfirm={onConfirm}
          labels={{
            ...BASE_LABELS,
            empty: ignoreLimits
              ? "No free times left in the override window."
              : "No available times right now.",
            advanceNote: ignoreLimits
              ? `Working hours & days off ignored (${OVERRIDE_WINDOW_LABEL}) — only taken slots are hidden.`
              : `You can book up to ${maxAdvanceDays} days in advance.`,
          }}
        />
      )}
    </div>
  )
}
