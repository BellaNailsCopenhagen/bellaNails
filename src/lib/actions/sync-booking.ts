"use server"

import { headers } from "next/headers"

import { CAL_UID_PATTERN, syncBookingFromCal } from "@/lib/booking-sync"

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
 * Pull-persist a booking right after embed success (see lib/booking-sync).
 * Deliberately unauthenticated: the booking flow runs signed-out, the uid is
 * an unguessable capability token, and the write is derived entirely from
 * Cal's data. Returns only ok/not — no booking data crosses back.
 */
export async function syncBooking(uid: string): Promise<{ ok: boolean }> {
  if (!CAL_UID_PATTERN.test(uid)) return { ok: false }

  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  if (!allow(ip, Date.now())) {
    console.error("[booking-sync] rate limited", ip)
    return { ok: false }
  }

  return syncBookingFromCal(uid)
}
