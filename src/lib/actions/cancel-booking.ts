"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@clerk/nextjs/server"

import { canManageBooking } from "@/lib/booking-display"
import { BOOKING_STATUS } from "@/lib/booking-status"
import { CAL_UID_PATTERN } from "@/lib/booking-sync"
import { cancelBookingAtCal } from "@/lib/booking-cancel"
import { createAuthedSupabaseServerClient } from "@/lib/supabase/server"

type CancelResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "not_found" | "within_policy" | "failed" }

/**
 * Cancel a booking in-app: ownership is proven by the RLS read (the authed
 * client only sees the caller's rows), the 24 h policy is re-checked
 * server-side (the UI disable is not a boundary), then Cal is told via API
 * v2. On success our row is mirrored immediately — the webhook lands the
 * same state idempotently.
 */
export async function cancelBooking(uid: string): Promise<CancelResult> {
  const { userId } = await auth()
  if (!userId) return { ok: false, error: "unauthorized" }
  if (!CAL_UID_PATTERN.test(uid)) return { ok: false, error: "not_found" }

  const supabase = createAuthedSupabaseServerClient()
  const { data: booking, error } = await supabase
    .from("bookings")
    .select("cal_uid, status, start_time")
    .eq("cal_uid", uid)
    .maybeSingle()
  if (error || !booking) return { ok: false, error: "not_found" }

  if (booking.status === BOOKING_STATUS.cancelled) {
    // Already cancelled out-of-band — refresh the stale card that offered
    // the button.
    revalidatePath("/[locale]/appointments", "page")
    return { ok: true }
  }
  if (!canManageBooking(booking, Date.now())) {
    return { ok: false, error: "within_policy" }
  }

  const result = await cancelBookingAtCal(
    uid,
    "Cancelled by the client via the website",
  )
  if (!result.ok) return { ok: false, error: "failed" }

  revalidatePath("/[locale]/appointments", "page")
  return { ok: true }
}
