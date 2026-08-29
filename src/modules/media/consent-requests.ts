import type { Db } from "@/db/client"
import { countRequestedFor as countRequestedDataConsents } from "@/db/client-consents"
import { countRequestedReleasesForClient } from "@/db/media-releases"

/**
 * Count of requests awaiting the client's decision (media releases + data-use).
 * Client-safe (no server-only imports) so both the home banner (browser client)
 * and My Space (server client) can use it. Filters on `clientId` explicitly —
 * RLS scopes a normal client, but the OWNER's owner-reads-all policy would
 * otherwise count the whole studio on their own personal surface.
 */
export async function pendingRequestCount(
  db: Db,
  clientId: string,
): Promise<number> {
  const [media, data] = await Promise.all([
    countRequestedReleasesForClient(db, clientId),
    countRequestedDataConsents(db, clientId),
  ])
  return media + data
}
