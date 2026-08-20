"use server"

import { revalidatePath } from "next/cache"

import { requireOwner } from "@/lib/admin/require-owner"
import { BOOKING_STATUS } from "@/lib/booking-status"
import { CAL_UID_PATTERN } from "@/lib/booking-sync"
import { cancelBookingAtCal } from "@/lib/booking-cancel"

type OwnerCancelResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "not_found" | "failed" }

/**
 * Cancel any booking on the studio's behalf. The owner role is re-verified
 * server-side (the UI is never the boundary); unlike the client action there is
 * **no 24 h policy** — the studio can cancel at any time. The row is read via
 * the service-role client (owner-reads-all RLS need not be applied for this to
 * work), then the shared Cal cancel + mirror runs and `/admin` revalidates.
 */
export async function cancelBookingAsOwner(
  uid: string,
): Promise<OwnerCancelResult> {
  const service = await requireOwner()
  if (!service) return { ok: false, error: "unauthorized" }
  if (!CAL_UID_PATTERN.test(uid)) return { ok: false, error: "not_found" }
  const { data: booking } = await service
    .from("bookings")
    .select("status")
    .eq("cal_uid", uid)
    .maybeSingle()
  if (!booking) return { ok: false, error: "not_found" }

  if (booking.status === BOOKING_STATUS.cancelled) {
    // Already cancelled out-of-band — refresh the stale card.
    revalidatePath("/admin")
    return { ok: true }
  }

  const result = await cancelBookingAtCal(uid, "Cancelled by the studio")
  if (!result.ok) return { ok: false, error: "failed" }

  revalidatePath("/admin")
  return { ok: true }
}
