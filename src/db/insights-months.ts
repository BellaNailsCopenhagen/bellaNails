import type { Db, Insert, Row } from "./client"

/**
 * `insights_months` — what a month's numbers were, kept.
 *
 * One column is the reason this table exists: `open_mins`. Every other figure
 * can be worked out again from the bookings; open hours come from the schedule,
 * which the artist edits, so recomputing a past month divides it by a week that
 * was not the week she kept. Null there means we were not watching that month
 * and the screen shows no percentage rather than a wrong one.
 *
 * Reads DEGRADE rather than throw — the table may not be migrated yet, and the
 * caller can always fall back to computing from bookings.
 */

export type InsightsMonthRow = Row<"insights_months">

/** The stored months within a key range, or null when the table can't be read
    (pre-migration, or a real fault) — which is not the same as "no months". */
export async function listInsightsMonths(
  db: Db,
  fromKey: number,
  toKey: number,
): Promise<InsightsMonthRow[] | null> {
  const { data, error } = await db
    .from("insights_months")
    .select("*")
    .gte("month_key", fromKey)
    .lte("month_key", toKey)
  if (error) {
    console.warn(
      "[insights] snapshots unavailable — computing live:",
      error.message,
    )

    return null
  }

  return data ?? []
}

/** Freeze a set of closed months. Upsert, so recomputing one replaces it. */
export async function upsertInsightsMonths(
  db: Db,
  rows: Insert<"insights_months">[],
): Promise<{ ok: boolean; message?: string }> {
  if (!rows.length) {
    return { ok: true }
  }
  const { error } = await db
    .from("insights_months")
    .upsert(rows, { onConflict: "month_key" })

  return error ? { ok: false, message: error.message } : { ok: true }
}

/**
 * Mark a month's MONEY as needing rebuilding — an income correction, or a
 * no-show marked on a past appointment.
 *
 * Marked, not deleted. Deleting would take `open_mins` with it, and the next
 * read would refill it from today's schedule — quietly rewriting the one figure
 * this table exists to hold still.
 */
export async function markInsightsMonthStale(
  db: Db,
  monthKey: number,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await db
    .from("insights_months")
    .update({ stale: true })
    .eq("month_key", monthKey)
  if (error) {
    console.error(
      `[insights] couldn't mark month ${monthKey} stale:`,
      error.message,
    )

    return { ok: false, message: error.message }
  }

  return { ok: true }
}

/**
 * Rebuild everything — the escape hatch for the one thing keeping costs you: a
 * month whose hours were captured wrong. This DOES drop `open_mins`, which is
 * the point; those months then show no percentage until they are lived through
 * again, rather than a figure nobody can vouch for.
 */
export async function clearInsightsMonths(
  db: Db,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await db
    .from("insights_months")
    .delete()
    .gte("month_key", 0)
  if (error) {
    console.error("[insights] couldn't clear snapshots:", error.message)

    return { ok: false, message: error.message }
  }

  return { ok: true }
}
