"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@clerk/nextjs/server"

import { canManageBooking } from "@/lib/booking-display"
import { BOOKING_STATUS } from "@/lib/booking-status"
import { CAL_UID_PATTERN, syncBookingFromCal } from "@/lib/booking-sync"
import {
  createAuthedSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server"
import { CALCOM_API_BASE } from "@/config/calcom"

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
    revalidatePath("/[locale]/bookings", "page")
    return { ok: true }
  }
  if (!canManageBooking(booking, Date.now())) {
    return { ok: false, error: "within_policy" }
  }

  const apiKey = process.env.CALCOM_API_KEY
  if (!apiKey) {
    console.error("[cancel-booking] CALCOM_API_KEY not configured")
    return { ok: false, error: "failed" }
  }

  let res: Response
  try {
    res = await fetch(`${CALCOM_API_BASE}/bookings/${uid}/cancel`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "cal-api-version": "2024-08-13",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cancellationReason: "Cancelled by the client via the website",
      }),
    })
  } catch (error) {
    console.error(
      "[cancel-booking] Cal API unreachable",
      error instanceof Error ? error.message : error,
    )
    return { ok: false, error: "failed" }
  }
  if (res.status >= 400 && res.status < 500) {
    // Usually "already cancelled" on Cal's side (our webhook missed it) —
    // reconcile from the authoritative source instead of guessing.
    console.error("[cancel-booking] Cal API 4xx — reconciling", uid, res.status)
    await syncBookingFromCal(uid)
    const { data: after } = await supabase
      .from("bookings")
      .select("status")
      .eq("cal_uid", uid)
      .maybeSingle()
    if (after?.status === BOOKING_STATUS.cancelled) {
      revalidatePath("/[locale]/bookings", "page")
      return { ok: true }
    }
    return { ok: false, error: "failed" }
  }
  if (!res.ok) {
    console.error("[cancel-booking] Cal API rejected", uid, res.status)
    return { ok: false, error: "failed" }
  }

  // Cal has cancelled — mirror now so the UI reflects it without waiting
  // for the webhook (which writes the same state again, harmlessly).
  const service = createSupabaseServiceRoleClient()
  const { error: mirrorError } = await service
    .from("bookings")
    .update({ status: BOOKING_STATUS.cancelled })
    .eq("cal_uid", uid)
  if (mirrorError) {
    // Cal-side cancel succeeded; the webhook will heal the row.
    console.error("[cancel-booking] mirror failed", mirrorError.message)
  }

  revalidatePath("/[locale]/bookings", "page")
  return { ok: true }
}
