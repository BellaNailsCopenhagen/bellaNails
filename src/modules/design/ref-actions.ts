"use server"

import { findDesignRefByKey } from "@/db/design-refs"
import { getCurrentUser } from "@/modules/identity/server"
import { deleteObject } from "@/platform/storage/supabase"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"

/**
 * Discarding a picked photo before sending it. The uploader writes to the
 * bucket the moment a file is chosen, so the "×" used to drop the object from
 * the submit and leave it in storage until the weekly orphan sweep found it —
 * a photo the client believes they deleted, sitting in a bucket for days.
 *
 * Only an UNATTACHED object can go this way: once a `design_refs` row points at
 * a key, deleting the object here would leave the thread rendering a broken
 * image, and retention (or erasure) owns it from then on.
 */
export async function discardUploadedRef(
  storageKey: string,
): Promise<{ ok: boolean }> {
  const user = await getCurrentUser()
  if (!user) return { ok: false }
  // Confines the delete to the reference area — the artist's private originals
  // live under a different prefix and are never reachable from this action.
  if (!storageKey.startsWith("refs/")) return { ok: false }

  // Fails closed on BOTH answers we can't act on: an attached key belongs to a
  // thread that renders it, and an unanswerable query might be either.
  const db = createSupabaseServiceRoleClient()
  const found = await findDesignRefByKey(db, storageKey).catch(() => ({
    ok: false as const,
  }))
  if (!found.ok || found.row) return { ok: false }

  const removed = await deleteObject(storageKey)
  if (!removed.ok) {
    // The weekly orphan sweep is the backstop; log so it is not silent.
    console.error("[design] discard left an orphan object:", removed.error)
  }
  return { ok: removed.ok }
}
