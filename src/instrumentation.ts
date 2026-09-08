/**
 * Runs once per server instance, before the first request (Next's
 * `instrumentation` convention).
 *
 * Its job is to say out loud which env-guarded protections are dark. Every
 * integration here degrades quietly by design — a missing key must never break
 * a deploy — but quiet degradation is invisible, and a booking form that has
 * silently stopped checking anything should not be discoverable only by
 * noticing a badge on a settings screen.
 */
export function register(): void {
  if (!process.env.HUMAN_CHECK_SECRET) {
    console.warn(
      '[boot] HUMAN_CHECK_SECRET is not set — the "I\'m not a robot" check is ' +
        "NOT running: the box is never shown and bookings are never asked for " +
        "a proof, whatever App settings says.",
    )
  }
}
