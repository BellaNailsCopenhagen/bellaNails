"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

import {
  getBookingLifecycle,
  setBookingNoShowAt,
} from "@/db/bookings"
import { requireOwner } from "@/modules/identity/require-owner"
import { getCurrentUser } from "@/modules/identity/server"
import { createAuthedSupabaseServerClient } from "@/platform/supabase/server"
import { BOOKING_STATUS } from "@/shared/booking-status"
import { canManageBooking, canMarkNoShow } from "@/shared/booking-policy"

import { cancelBookingAtCal } from "./cancel-at-cal"
import { CAL_UID_PATTERN, syncBookingFromCal } from "./sync-from-cal"

/**
 * Every booking mutation a UI can trigger. Each one re-establishes who the
 * caller is before it does anything — the UI is never the authorization
 * boundary — then delegates the actual work to this module's internals.
 */

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
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "unauthorized" }
  if (!CAL_UID_PATTERN.test(uid)) return { ok: false, error: "not_found" }

  const supabase = await createAuthedSupabaseServerClient()
  const booking = await getBookingLifecycle(supabase, uid)
  if (!booking) return { ok: false, error: "not_found" }

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

type OwnerCancelResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "not_found" | "failed" }

/**
 * Cancel any booking on the studio's behalf. Unlike the client action there is
 * **no 24 h policy** — the studio can cancel at any time.
 */
export async function cancelBookingAsOwner(
  uid: string,
): Promise<OwnerCancelResult> {
  const service = await requireOwner()
  if (!service) return { ok: false, error: "unauthorized" }
  if (!CAL_UID_PATTERN.test(uid)) return { ok: false, error: "not_found" }

  const booking = await getBookingLifecycle(service, uid)
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

type NoShowResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "not_found" | "ineligible" | "failed" }

/**
 * Toggle the studio-side no-show marker. `no_show_at` is OUR column, separate
 * from the Cal-synced `status`, so a later webhook can't clobber it and clients
 * never see it. Setting a mark re-checks eligibility (an hour past start);
 * clearing one is always allowed.
 */
export async function setBookingNoShow(
  uid: string,
  noShow: boolean,
): Promise<NoShowResult> {
  const service = await requireOwner()
  if (!service) return { ok: false, error: "unauthorized" }
  if (!CAL_UID_PATTERN.test(uid)) return { ok: false, error: "not_found" }

  const booking = await getBookingLifecycle(service, uid)
  if (!booking) return { ok: false, error: "not_found" }
  if (noShow && !canMarkNoShow(booking, Date.now())) {
    return { ok: false, error: "ineligible" }
  }

  const result = await setBookingNoShowAt(
    service,
    uid,
    noShow ? new Date().toISOString() : null,
  )
  if (!result.ok) return { ok: false, error: "failed" }

  revalidatePath("/admin")
  revalidatePath("/admin/appointments")
  return { ok: true }
}

/** Per-instance sliding-window throttle. Not distributed (each serverless
    instance counts separately) — the goal is blunting junk-uid loops that
    would burn the Cal API key's rate budget, not precise global limiting. */
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 10
const hits = new Map<string, number[]>()

function allow(key: string, now: number): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  if (recent.length >= MAX_PER_WINDOW) return false
  recent.push(now)
  hits.set(key, recent)
  // Bound the map — a scan rotating IPs must not grow memory unbounded.
  if (hits.size > 1000) hits.clear()
  return true
}

/**
 * Pull-persist a booking right after embed success. Deliberately
 * unauthenticated: the booking flow runs signed-out, the uid is an
 * unguessable capability token, and the write is derived entirely from Cal's
 * data. Returns only ok/not — no booking data crosses back.
 */
export async function syncBooking(uid: string): Promise<{ ok: boolean }> {
  if (!CAL_UID_PATTERN.test(uid)) return { ok: false }

  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  if (!allow(ip, Date.now())) {
    console.error("[booking-sync] rate limited", ip)
    return { ok: false }
  }

  return syncBookingFromCal(uid)
}
