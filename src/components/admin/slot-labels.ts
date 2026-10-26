import { OVERRIDE_WINDOW_LABEL } from "@/shared/booking-slots"
import type { SlotPickerLabels } from "@/components/booking/slot-picker"

/**
 * The admin SlotPicker's wording. English by design — the admin has no
 * next-intl context (see `config/admin.ts`).
 *
 * One builder rather than a copy per card: this object was defined
 * near-identically in the booking-request card and the design-offer card, so
 * adding or renaming a `SlotPickerLabels` field meant editing every copy, and
 * they could drift into saying different things about the same picker.
 *
 * `override` is the "ignore hours & days off" variant — the only line that
 * differs between the two, and the reason it is a function.
 */
export function adminSlotLabels({
  override = false,
}: { override?: boolean } = {}): SlotPickerLabels {
  return {
    chooseDate: "Choose a date",
    chooseTime: "Choose a time",
    empty: "No available times right now.",
    confirm: "Book this time",
    confirming: "Booking…",
    genericError: "Couldn’t book — try another time.",
    advanceNote: override
      ? `Working hours & days off ignored (${OVERRIDE_WINDOW_LABEL}) — only taken slots are hidden.`
      : "The studio's normal available times.",
    availableLegend: "Available",
    prevMonth: "Previous month",
    nextMonth: "Next month",
  }
}
