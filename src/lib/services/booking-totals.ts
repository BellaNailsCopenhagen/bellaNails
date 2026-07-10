import type { BookingLineItem } from "@/components/sections/appointment-summary";

type BookingTotals = {
  /** Real treatment price, base + selected add-ons. */
  totalCents: number;
  /** Real treatment time in minutes — what the client is told. */
  totalMins: number;
  /**
   * The Cal.com slot length: `totalMins` rounded UP to the base duration's
   * 15-minute grid (the steps each event type offers). Over-reserving ≤14
   * minutes is fine; under-reserving would collide back-to-back bookings —
   * never round down.
   */
  slotMins: number;
};

/**
 * The one place booking totals are computed — the summary card, the embed
 * handoff, and the notes summary all read from here so the numbers can't
 * disagree between steps.
 */
export function computeBookingTotals(
  service: BookingLineItem,
  selectedAddons: BookingLineItem[],
): BookingTotals {
  const totalCents =
    service.priceCents +
    selectedAddons.reduce((sum, addon) => sum + addon.priceCents, 0);
  const totalMins =
    service.durationMins +
    selectedAddons.reduce((sum, addon) => sum + addon.durationMins, 0);
  const slotMins =
    service.durationMins +
    Math.ceil((totalMins - service.durationMins) / 15) * 15;

  return { totalCents, totalMins, slotMins };
}

export type { BookingTotals };
