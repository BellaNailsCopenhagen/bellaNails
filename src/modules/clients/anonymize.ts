"use server"

import { revalidatePath } from "next/cache"
import { clearClientNotes } from "@/db/bookings"
import type { Db } from "@/db/client"
import {
  deleteMedia,
  listOwnUploadsForClient,
} from "@/db/client-media"
import { anonymizeClientRow, getClientErasureState } from "@/db/clients"
import { scrubCommunicationsForClient } from "@/db/communications"
import { hasArtistUseSignal } from "@/db/media-consents"
import { requireOwner } from "@/modules/identity/require-owner"
import { getCurrentUser } from "@/modules/identity/server"
import { purgeMediaArtifacts } from "@/modules/media/erasure"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"
import { routes } from "@/shared/routes"

export type AnonymizeResult = { ok: true } | { ok: false; error: string }

type Admin = Db

/**
 * A client_media the artist is using or has curated — kept on erasure (the
 * client's lever for these is per-item consent withdrawal, not deletion).
 * Conservative: any grant / auto-place / publish / favourite signal keeps it.
 */
async function isArtistInUse(
  admin: Admin,
  media: { id: string; favorited_at: string | null },
): Promise<boolean> {
  if (media.favorited_at) return true
  return hasArtistUseSignal(admin, media.id)
}

/**
 * GDPR erasure = ANONYMIZE, not hard-delete (see docs/tasks/PII-GDPR.md). Keeps
 * the client row + its bookings/consents/links (financial retention + proof),
 * scrubs the PII, removes the login, and deletes only the client's OWN unused
 * uploads. Artist-owned / published media stays. Idempotent.
 *
 * Never reports success while PII survives: if any storage object won't delete,
 * the auth account can't be removed, or a scrub fails, it aborts BEFORE stamping
 * `anonymized_at` so a re-run retries cleanly. Callers authorize first.
 */
async function runAnonymize(
  admin: Admin,
  clientId: string,
): Promise<AnonymizeResult> {
  try {
    const state = await getClientErasureState(admin, clientId)
    if (!state.ok) return { ok: false, error: state.message }
    const client = state.row
    if (!client) return { ok: false, error: "client not found" }
    if (client.anonymized_at) return { ok: true } // already anonymized

    // 1. Delete the client's OWN uploads the artist isn't using/curating.
    const ownMedia = await listOwnUploadsForClient(admin, clientId)
    for (const media of ownMedia) {
      if (await isArtistInUse(admin, media)) continue
      if (!(await purgeMediaArtifacts(media.id))) {
        return { ok: false, error: "storage delete failed — retry" }
      }
      const removed = await deleteMedia(admin, media.id)
      if (!removed.ok) return { ok: false, error: removed.message! }
    }

    // 2. Remove the login. 404 = already gone (idempotent retry); any other
    //    error must fail so the auth PII isn't silently left orphaned.
    if (client.auth_user_id) {
      const { error: authError } = await admin.auth.admin.deleteUser(
        client.auth_user_id,
      )
      const notFound =
        authError?.status === 404 || /not.?found/i.test(authError?.message ?? "")
      if (authError && !notFound) {
        return { ok: false, error: `auth delete failed: ${authError.message}` }
      }
    }

    // 3. Scrub PII (keep the row + id + all links). Stamp anonymized last.
    const notes = await clearClientNotes(admin, clientId)
    if (!notes.ok) return { ok: false, error: notes.message! }
    // Communications' only PII is the recipient email — scrub it, keep the log
    // (kind/status/when), like the anonymized bookings it trails.
    const comms = await scrubCommunicationsForClient(admin, clientId)
    if (!comms.ok) return { ok: false, error: comms.message! }
    const scrubbed = await anonymizeClientRow(admin, clientId)
    if (!scrubbed.ok) return { ok: false, error: scrubbed.message! }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "erasure failed" }
  }
}

/** Owner erases a client on request (admin control). */
export async function anonymizeClient(
  clientId: string,
): Promise<AnonymizeResult> {
  const admin = await requireOwner()
  if (!admin) return { ok: false, error: "unauthorized" }
  const result = await runAnonymize(admin, clientId)
  if (result.ok) {
    revalidatePath(routes.admin.client(clientId))
    revalidatePath(routes.admin.clients)
  }
  return result
}

/** A signed-in client erases their own account (My space). */
export async function deleteMyAccount(): Promise<AnonymizeResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "not signed in" }
  return runAnonymize(createSupabaseServiceRoleClient(), user.id)
}
