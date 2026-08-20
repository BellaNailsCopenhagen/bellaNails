import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/platform/supabase/types"

/**
 * Count of consent requests awaiting the client's decision (image-publish +
 * data-use). Client-safe (no server-only imports) so both the home banner
 * (browser client) and the /bookings page (server client) can use it. Filters
 * on `clientId` explicitly — RLS scopes a normal client, but the OWNER's
 * owner-reads-all policy would otherwise count the whole studio on their own
 * personal surface.
 */
export async function pendingRequestCount(
  supabase: SupabaseClient<Database>,
  clientId: string,
): Promise<number> {
  const [mediaRes, dataRes] = await Promise.all([
    supabase
      .from("media_consents")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("status", "requested"),
    supabase
      .from("client_consents")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("status", "requested"),
  ])
  return (mediaRes.count ?? 0) + (dataRes.count ?? 0)
}
