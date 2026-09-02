import "server-only"

import type { Db } from "@/db/client"
import { touchArtistReply } from "@/db/design-requests"

/**
 * Raise the client's "the studio answered" banner. Three writers need it — a
 * reply, an offer, and a close — so it lives here once rather than as the same
 * bare `await` in two files.
 *
 * Best-effort: a missed stamp costs a banner, not the answer. Never silent
 * though — a client left believing nobody wrote back is the same class of
 * inconsistency as a request stuck on `open`, and nothing else would say so.
 */
export async function stampArtistReply(
  db: Db,
  requestId: string,
  at = new Date().toISOString(),
): Promise<void> {
  const stamped = await touchArtistReply(db, requestId, at)
  if (!stamped.ok) {
    console.error(
      `[design] reply stamp missed on ${requestId} — the client won't be told:`,
      stamped.message,
    )
  }
}
