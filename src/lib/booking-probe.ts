import { syncBooking } from "@/lib/actions/sync-booking"

/** Post-success wait: after Cal creates/reschedules a booking, poll for our
    webhook-written row before navigating (~15 s worst case). Deliberately
    not cancellable — once Cal has acted, the flow must move forward. */
const PROBE_DELAYS_MS = [0, 1000, 2000, 3000, 4000, 5000]

export async function waitForBookingRow(uid: string): Promise<void> {
  for (const delay of PROBE_DELAYS_MS) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
    try {
      const res = await fetch(
        `/api/bookings/${encodeURIComponent(uid)}?probe=1`,
      )
      if (res.ok) return
    } catch {
      // Network hiccup — try the next probe.
    }
  }
}

/** Sync-first (Cal's webhook queue lags), probe as fallback. Never rejects —
    callers navigate unconditionally after it settles. */
/** Hard cap on the post-success hold: navigate even if sync and probe are
    both slow — the destination pages degrade gracefully to webhook timing. */
const SETTLE_CAP_MS = 5000

export async function settleBookingRow(uid: string): Promise<void> {
  const settle = (async () => {
    try {
      if ((await syncBooking(uid)).ok) return
    } catch {
      // Action unreachable — fall through to the probe.
    }
    await waitForBookingRow(uid)
  })()
  await Promise.race([
    settle,
    new Promise((resolve) => setTimeout(resolve, SETTLE_CAP_MS)),
  ])
}
