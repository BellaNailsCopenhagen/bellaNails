"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@clerk/nextjs/server"

import { isOwner } from "@/lib/admin/owner"
import { canMarkNoShow } from "@/lib/booking-display"
import { CAL_UID_PATTERN } from "@/lib/booking-sync"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

type NoShowResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "not_found" | "ineligible" | "failed" }

/**
 * Toggle the studio-side no-show marker on a booking. Owner-only (role
 * re-verified server-side; the UI is never the boundary) and written with the
 * service-role client. `no_show_at` is OUR column, separate from the Cal-synced
 * `status`, so a later webhook can't clobber it and clients never see it.
 *
 * Setting a mark re-checks eligibility (an hour past start); clearing one is
 * always allowed. The realtime `bookings` subscription plus these revalidations
 * refresh every open admin surface.
 */
export async function setBookingNoShow(
  uid: string,
  noShow: boolean,
): Promise<NoShowResult> {
  const { userId, sessionClaims } = await auth()
  if (!userId || !isOwner(sessionClaims)) {
    return { ok: false, error: "unauthorized" }
  }
  if (!CAL_UID_PATTERN.test(uid)) return { ok: false, error: "not_found" }

  const service = createSupabaseServiceRoleClient()
  const { data: booking } = await service
    .from("bookings")
    .select("status, start_time")
    .eq("cal_uid", uid)
    .maybeSingle()
  if (!booking) return { ok: false, error: "not_found" }

  const now = new Date().getTime()
  if (noShow && !canMarkNoShow(booking, now)) {
    return { ok: false, error: "ineligible" }
  }

  const { error } = await service
    .from("bookings")
    .update({ no_show_at: noShow ? new Date().toISOString() : null })
    .eq("cal_uid", uid)
  if (error) return { ok: false, error: "failed" }

  revalidatePath("/admin")
  revalidatePath("/admin/appointments")
  return { ok: true }
}
