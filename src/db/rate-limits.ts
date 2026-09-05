import type { Db } from "./client"

/**
 * `rate_limits` — a durable fixed-window counter, one row per key.
 *
 * The counting happens inside Postgres (`take_rate_limit_token`), which is the
 * whole point: `shared/rate-limit.ts` keeps its state in one process, so a
 * serverless deployment enforces it per instance. A public write that has to be
 * bounded globally needs the database to be the one doing the arithmetic.
 */

export type RateLimitRule = {
  /** Hits allowed per window. */
  limit: number
  /** Window length, as a Postgres interval literal ("1 hour", "10 minutes"). */
  window: string
}

/**
 * Record one hit for `key`; true when it is allowed.
 *
 * **Fails OPEN.** A limiter that blocks when the database hiccups turns a
 * transient error into "nobody can book" — the wrong trade for a guard that
 * sits behind a validated sign-in and a honeypot.
 */
export async function takeDurableToken(
  db: Db,
  key: string,
  rule: RateLimitRule,
): Promise<boolean> {
  const { data, error } = await db.rpc("take_rate_limit_token", {
    p_key: key,
    p_limit: rule.limit,
    p_window: rule.window,
  })
  if (error) {
    console.error("[rate-limit] check failed, allowing:", error.code)
    return true
  }
  return data !== false
}

/** Drop keys whose window closed long ago — hygiene, from housekeeping. */
export async function purgeExpiredRateLimits(db: Db): Promise<number> {
  const { data, error } = await db.rpc("purge_expired_rate_limits", {})
  return error ? 0 : (data ?? 0)
}
