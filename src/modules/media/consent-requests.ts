import type { Db } from "@/db/client"
import { countRequestedFor as countRequestedDataConsents } from "@/db/client-consents"
import { countRequestedFor as countRequestedMediaConsents } from "@/db/media-consents"

/**
 * Count of consent requests awaiting the client's decision (image-publish +
 * data-use). Client-safe (no server-only imports) so both the home banner
 * (browser client) and the /bookings page (server client) can use it. Filters
 * on `clientId` explicitly — RLS scopes a normal client, but the OWNER's
 * owner-reads-all policy would otherwise count the whole studio on their own
 * personal surface.
 */
export async function pendingRequestCount(
  db: Db,
  clientId: string,
): Promise<number> {
  const [media, data] = await Promise.all([
    countRequestedMediaConsents(db, clientId),
    countRequestedDataConsents(db, clientId),
  ])
  return media + data
}
