import "server-only"

import type { Db } from "@/db/client"
import {
  deleteDesignRefs,
  listDesignRefKeys,
  listDesignRefsForClient,
  listDesignRefsToPurge,
} from "@/db/design-refs"
import {
  deleteObject,
  deleteObjects,
  listObjects,
} from "@/platform/storage/supabase"

/**
 * Reference photos are borrowed, not ours — usually a screenshot of someone
 * else's work — so they are deleted rather than kept. Two callers: the routine
 * retention sweep, and GDPR erasure.
 *
 * Storage first, then the rows: a failed object delete leaves a row that the
 * next sweep retries, which is recoverable. The reverse would orphan the file.
 */

async function destroy(
  db: Db,
  refs: { id: string; storage_key: string }[],
): Promise<number> {
  if (!refs.length) return 0

  // Delete the object FIRST, and only forget the row if that succeeded. A row
  // whose object survived is the only thing that lets the next sweep retry —
  // dropping it anyway would leave the file orphaned and, on the erasure path,
  // report success while the client's photos are still in the bucket.
  const results = await Promise.all(
    refs.map(async (ref) => ({
      ref,
      gone: (await deleteObject(ref.storage_key)).ok,
    })),
  )
  const deleted = results.filter((r) => r.gone).map((r) => r.ref)
  const failed = results.length - deleted.length
  if (failed) {
    console.error(`[design] ${failed} reference object(s) failed to delete — rows kept for retry`)
  }
  if (!deleted.length) return 0

  const removed = await deleteDesignRefs(db, deleted.map((r) => r.id))
  if (!removed.ok) {
    console.error("[design] refs purged from storage but not the table:", removed.message)
    return 0
  }
  return deleted.length
}

/** Retention sweep — drops references past `purge_after`. */
export async function purgeExpiredDesignRefs(db: Db, limit = 100): Promise<number> {
  const due = await listDesignRefsToPurge(db, new Date().toISOString(), limit)
  return destroy(db, due)
}

// One listing page, and the most objects one sweep will look at.
const PAGE = 100
const MAX_SWEEP_SCAN = 1000

/**
 * Objects uploaded but never submitted. The form uploads a photo as soon as it
 * is picked, so a client who abandons the form — or removes a photo before
 * sending — leaves an object with no row behind it, which the row-driven sweep
 * above can never see. This sweeps the bucket instead.
 *
 * `minAgeMs` keeps it well clear of a form still being filled in.
 */
export async function purgeOrphanedRefObjects(
  db: Db,
  opts: { minAgeMs?: number; limit?: number } = {},
): Promise<number> {
  // Generous on purpose: the form uploads on file-pick but writes rows only on
  // submit, so anything younger than this may still belong to an open form.
  const { minAgeMs = 7 * 24 * 60 * 60 * 1000, limit = 100 } = opts
  const cutoff = Date.now() - minAgeMs

  // COLLECT first, delete after. Deleting mid-scan shifts every later object
  // down a slot, so advancing the offset by a page would skip whatever moved
  // into the space the deletions freed.
  //
  // Paging at all is necessary because most objects ARE attached: a single page
  // would fill with legitimate refs and hide the orphans sitting behind them.
  const orphans: string[] = []
  for (let offset = 0; offset < MAX_SWEEP_SCAN && orphans.length < limit; offset += PAGE) {
    const listed = await listObjects("refs", PAGE, offset)
    if (!listed.ok || !listed.data.length) break

    const candidates = listed.data.filter(
      (object) => Date.parse(object.createdAt) < cutoff,
    )
    if (candidates.length) {
      const attached = await listDesignRefKeys(db, candidates.map((c) => c.key))
      for (const candidate of candidates) {
        if (!attached.has(candidate.key)) orphans.push(candidate.key)
      }
    }
    // Listing is oldest-first, so once a page is entirely too new, so is the rest.
    if (candidates.length < listed.data.length || listed.data.length < PAGE) break
  }
  if (!orphans.length) return 0

  const batch = orphans.slice(0, limit)
  const removed = await deleteObjects(batch)
  if (!removed.ok) {
    console.error("[design] orphan batch delete failed:", removed.error)
    return 0
  }
  return batch.length
}

/** GDPR erasure — every reference this client ever attached. */
export async function purgeDesignRefsForClient(
  db: Db,
  clientId: string,
): Promise<number> {
  return destroy(db, await listDesignRefsForClient(db, clientId))
}
