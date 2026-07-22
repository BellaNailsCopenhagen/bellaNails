import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/types"

/**
 * Client no-show reputation from the `no_show_at` column, keyed by
 * `clerk_user_id`. Raw counts; callers own the policy. Client-safe.
 */

/** At/above this, a client is a repeat offender (gate + admin share it). */
export const NO_SHOW_ALERT_THRESHOLD = 2

/** Batch clerk_user_id → no-show count in one query; absent = zero. */
export async function fetchNoShowCounts(
  supabase: SupabaseClient<Database>,
  clerkUserIds: (string | null | undefined)[],
): Promise<Record<string, number>> {
  const ids = [
    ...new Set(clerkUserIds.filter((id): id is string => Boolean(id))),
  ]
  if (ids.length === 0) return {}

  const { data, error } = await supabase
    .from("bookings")
    .select("clerk_user_id")
    .in("clerk_user_id", ids)
    .not("no_show_at", "is", null)
  if (error) throw new Error(error.message)

  const counts: Record<string, number> = {}
  for (const { clerk_user_id } of data ?? []) {
    counts[clerk_user_id] = (counts[clerk_user_id] ?? 0) + 1
  }
  return counts
}
