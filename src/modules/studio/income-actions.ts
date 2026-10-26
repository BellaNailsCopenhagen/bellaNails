"use server"

import { revalidatePath } from "next/cache"

import { getBookingForManage, setBookingIncomeOverride } from "@/db/bookings"
import {
  clearInsightsMonths,
  markInsightsMonthStale,
} from "@/db/insights-months"
import { requireOwner } from "@/modules/identity/require-owner"
import { monthKeyOf } from "@/modules/studio/insights"
import { routes } from "@/shared/routes"

/**
 * The artist's own correction to what an appointment earned — a refund, a
 * no-show fee she actually took, a tip, a discount given off the system.
 *
 * It never touches `total_price_cents`: the booked price stays the source of
 * truth and this sits beside it, so the two can always be compared and the
 * screen can mark the row as adjusted. Owner-only, service-role write.
 */
export type IncomeResult =
  { ok: true; note?: string } | { ok: false; error: string }

export async function setAppointmentIncome(
  bookingId: string,
  cents: number | null,
): Promise<IncomeResult> {
  const db = await requireOwner()
  if (!db) {
    return { ok: false, error: "unauthorized" }
  }

  // A negative figure is not a refund — it is a typo. Money given back is
  // recorded by lowering what the appointment earned, to zero if need be.
  if (cents !== null && (!Number.isFinite(cents) || cents < 0)) {
    return { ok: false, error: "Enter an amount of 0 or more." }
  }

  // Read it BEFORE the write: which month this belongs to is what has to be
  // un-frozen, and the row is easier to find while it is still the one we know.
  const booking = await getBookingForManage(db, bookingId)

  const saved = await setBookingIncomeOverride(
    db,
    bookingId,
    cents === null ? null : Math.round(cents),
  )
  if (!saved.ok) {
    return {
      ok: false,
      error:
        saved.message === "not_found"
          ? "That appointment is no longer there."
          : "Couldn’t save the amount.",
    }
  }

  // A closed month is served from a kept row, so correcting an old appointment
  // has to mark its money stale — otherwise the total she just changed stays as
  // it was. Marked, not dropped: that month's open hours are still true.
  if (booking?.start_time) {
    await markInsightsMonthStale(db, monthKeyOf(booking.start_time))
  }

  revalidatePath(routes.admin.insights)
  revalidatePath(routes.admin.appointments)

  return {
    ok: true,
    note: cents === null ? "Back to the booked price" : "Saved",
  }
}

/**
 * Throw away every frozen month and work them all out again.
 *
 * The escape hatch for the one thing freezing costs you: a snapshot keeps the
 * opening hours it was taken with, so if the schedule was wrong when a month
 * closed, its share of open hours stays wrong. Rare, and nothing else can fix
 * it — the app cannot know the hours were edited to correct a mistake rather
 * than to change the week.
 */
export async function recalculateInsights(): Promise<IncomeResult> {
  const db = await requireOwner()
  if (!db) {
    return { ok: false, error: "unauthorized" }
  }

  const cleared = await clearInsightsMonths(db)
  if (!cleared.ok) {
    // The only escape hatch there is — a silent failure here is the difference
    // between a fixable number and one nobody can correct.
    return { ok: false, error: "Couldn’t clear them — try again in a moment." }
  }

  revalidatePath(routes.admin.insights)

  return { ok: true, note: "Worked out again from your appointments" }
}
