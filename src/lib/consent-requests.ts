import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/types"

/**
 * Count of consent requests awaiting the client's decision (image-publish +
 * data-use). Client-safe (no server-only imports) so both the home banner
 * (browser client) and the /bookings page (server client) can use it; RLS
 * scopes rows to the caller either way.
 */
export async function pendingRequestCount(
  supabase: SupabaseClient<Database>,
  clerkUserId: string,
): Promise<number> {
  const [mediaRes, dataRes] = await Promise.all([
    supabase
      .from("media_consents")
      .select("id", { count: "exact", head: true })
      .eq("clerk_user_id", clerkUserId)
      .eq("status", "requested"),
    supabase
      .from("client_consents")
      .select("id", { count: "exact", head: true })
      .eq("clerk_user_id", clerkUserId)
      .eq("status", "requested"),
  ])
  return (mediaRes.count ?? 0) + (dataRes.count ?? 0)
}
