import "server-only"

import { BOOKING_STATUS } from "@/lib/booking-status"
import { syncBookingFromCal } from "@/lib/booking-sync"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { CALCOM_API_BASE } from "@/config/calcom"

/**
 * Cancel a booking at Cal (API v2) and mirror our row to `cancelled`. The
 * transport + reconcile + mirror shared by the client cancel action and the
 * owner cancel action.
 *
 * **The caller owns authorization** (client: RLS ownership + 24 h policy;
 * owner: role check). This runs post-auth and uses the service-role client, so
 * it must never be called before the caller has authorized the cancellation.
 *
 * On a Cal 4xx (usually "already cancelled" — our webhook missed it) it
 * reconciles from Cal instead of guessing, and reports success only if the row
 * ends up cancelled. On success our row is mirrored now; the webhook writes the
 * same state again, harmlessly.
 */
export async function cancelBookingAtCal(
  uid: string,
  cancellationReason: string,
): Promise<{ ok: boolean }> {
  const apiKey = process.env.CALCOM_API_KEY
  if (!apiKey) {
    console.error("[cancel-booking] CALCOM_API_KEY not configured")
    return { ok: false }
  }

  const service = createSupabaseServiceRoleClient()

  let res: Response
  try {
    res = await fetch(`${CALCOM_API_BASE}/bookings/${uid}/cancel`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "cal-api-version": "2024-08-13",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cancellationReason }),
    })
  } catch (error) {
    console.error(
      "[cancel-booking] Cal API unreachable",
      error instanceof Error ? error.message : error,
    )
    return { ok: false }
  }

  if (res.status >= 400 && res.status < 500) {
    console.error("[cancel-booking] Cal API 4xx — reconciling", uid, res.status)
    // Reconcile must not throw out of the action (that would leave the confirm
    // dialog stuck) — a failed reconcile is just a failed cancel.
    try {
      await syncBookingFromCal(uid)
    } catch (error) {
      console.error(
        "[cancel-booking] reconcile failed",
        error instanceof Error ? error.message : error,
      )
      return { ok: false }
    }
    const { data: after } = await service
      .from("bookings")
      .select("status")
      .eq("cal_uid", uid)
      .maybeSingle()
    return { ok: after?.status === BOOKING_STATUS.cancelled }
  }
  if (!res.ok) {
    console.error("[cancel-booking] Cal API rejected", uid, res.status)
    return { ok: false }
  }

  const { error: mirrorError } = await service
    .from("bookings")
    .update({ status: BOOKING_STATUS.cancelled })
    .eq("cal_uid", uid)
  if (mirrorError) {
    // Cal-side cancel succeeded; the webhook will heal the row.
    console.error("[cancel-booking] mirror failed", mirrorError.message)
  }
  return { ok: true }
}
