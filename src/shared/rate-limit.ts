/**
 * A fixed-window counter, as a pure function over caller-held state. Pure so it
 * is testable and layer-free; the caller owns the Map, which makes the scope of
 * the limit explicit at the call site.
 *
 * **Best-effort by design.** The state lives in one process, so a serverless
 * deployment enforces it per instance rather than globally. That is enough to
 * stop a single client hammering an endpoint in a loop; it is not a defence
 * against a distributed attacker. A durable limiter (Postgres or an external
 * store) is the real answer if volume ever justifies one.
 */
export type RateLimitState = Map<string, { count: number; resetAt: number }>

export type RateLimitRule = { limit: number; windowMs: number }

/**
 * Record one hit for `key`. Returns whether it is allowed. Expired windows are
 * swept as they're touched, so the Map can't grow without bound for keys that
 * stop being used.
 */
export function takeToken(
  state: RateLimitState,
  key: string,
  now: number,
  rule: RateLimitRule,
): boolean {
  const entry = state.get(key)
  if (!entry || entry.resetAt <= now) {
    state.set(key, { count: 1, resetAt: now + rule.windowMs })
    sweep(state, now)
    return true
  }
  if (entry.count >= rule.limit) return false
  entry.count += 1
  return true
}

// Bounded work: only runs when a window rolls over, and only for dead keys.
function sweep(state: RateLimitState, now: number): void {
  for (const [key, entry] of state) {
    if (entry.resetAt <= now) state.delete(key)
  }
}
