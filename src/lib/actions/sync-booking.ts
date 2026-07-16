"use server"

import { CAL_UID_PATTERN, syncBookingFromCal } from "@/lib/booking-sync"

/**
 * Pull-persist a booking right after embed success (see lib/booking-sync).
 * Deliberately unauthenticated: the booking flow runs signed-out, the uid is
 * an unguessable capability token, and the write is derived entirely from
 * Cal's data. Returns only ok/not — no booking data crosses back.
 */
export async function syncBooking(uid: string): Promise<{ ok: boolean }> {
  if (!CAL_UID_PATTERN.test(uid)) return { ok: false }
  return syncBookingFromCal(uid)
}
