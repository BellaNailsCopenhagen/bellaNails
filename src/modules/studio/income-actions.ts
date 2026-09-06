"use server"

import { revalidatePath } from "next/cache"

import { setBookingIncomeOverride } from "@/db/bookings"
import { requireOwner } from "@/modules/identity/require-owner"
import { routes } from "@/shared/routes"

/**
 * The artist's own correction to what an appointment earned — a refund, a
 * no-show fee she actually took, a tip, a discount given off the system.
 *
 * It never touches `total_price_cents`: the booked price stays the source of
 * truth and this sits beside it, so the two can always be compared and the
 * screen can mark the row as adjusted. Owner-only, service-role write.
 */
export type IncomeResult = { ok: true; note?: string } | { ok: false; error: string }

export async function setAppointmentIncome(
  bookingId: string,
  cents: number | null,
): Promise<IncomeResult> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "unauthorized" }

  // A negative figure is not a refund — it is a typo. Money given back is
  // recorded by lowering what the appointment earned, to zero if need be.
  if (cents !== null && (!Number.isFinite(cents) || cents < 0)) {
    return { ok: false, error: "Enter an amount of 0 or more." }
  }

  const saved = await setBookingIncomeOverride(
    db,
    bookingId,
    cents === null ? null : Math.round(cents),
  )
  if (!saved.ok) return { ok: false, error: "Couldn’t save the amount." }

  revalidatePath(routes.admin.insights)
  revalidatePath(routes.admin.appointments)
  return { ok: true, note: cents === null ? "Back to the booked price" : "Saved" }
}
