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
