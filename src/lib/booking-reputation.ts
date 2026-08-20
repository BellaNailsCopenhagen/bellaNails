import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/platform/supabase/types"

/**
 * Client no-show reputation from the `no_show_at` column, keyed by
 * `client_id`. Raw counts; callers own the policy. Client-safe.
 */

/** At/above this, a client is a repeat offender (gate + admin share it). */
export const NO_SHOW_ALERT_THRESHOLD = 2

/** Batch client_id → no-show count in one query; absent = zero. */
export async function fetchNoShowCounts(
  supabase: SupabaseClient<Database>,
  clientIds: (string | null | undefined)[],
): Promise<Record<string, number>> {
  const ids = [
    ...new Set(clientIds.filter((id): id is string => Boolean(id))),
  ]
  if (ids.length === 0) return {}

  const { data, error } = await supabase
    .from("bookings")
    .select("client_id")
    .in("client_id", ids)
    .not("no_show_at", "is", null)
  if (error) throw new Error(error.message)

  const counts: Record<string, number> = {}
  for (const { client_id } of data ?? []) {
    counts[client_id] = (counts[client_id] ?? 0) + 1
  }
  return counts
}
