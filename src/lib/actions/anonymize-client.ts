"use server"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"

import { requireOwner } from "@/lib/admin/require-owner"
import { purgeMediaArtifacts } from "@/lib/media-erasure"
import type { Database } from "@/lib/supabase/types"

export type AnonymizeResult = { ok: true } | { ok: false; error: string }

/**
 * A client_media the artist is using or has curated — kept on erasure (the
 * client's lever for these is per-item consent withdrawal, not deletion).
 * Conservative: any grant / auto-place / publish / favourite signal keeps it.
 */
async function isArtistInUse(
  admin: SupabaseClient<Database>,
  media: { id: string; favorited_at: string | null },
): Promise<boolean> {
  if (media.favorited_at) return true
  const { data } = await admin
    .from("media_consents")
    .select("id")
    .eq("client_media_id", media.id)
    .or("published_asset_id.not.is.null,status.eq.granted,auto_place.eq.true")
    .limit(1)
  return Boolean(data?.length)
}

/**
 * GDPR erasure = ANONYMIZE, not hard-delete (see docs/tasks/PII-GDPR.md). Keeps
 * the client row + its bookings/consents/links (financial retention + proof),
 * scrubs the PII, removes the login, and deletes only the client's OWN unused
 * uploads. Artist-owned / published media stays. Owner-only; idempotent.
 *
 * Never reports success while PII survives: if a storage object won't delete or
 * the auth account can't be removed, it aborts BEFORE stamping `anonymized_at`
 * so a re-run retries.
 */
export async function anonymizeClient(
  clientId: string,
): Promise<AnonymizeResult> {
  const admin = await requireOwner()
  if (!admin) return { ok: false, error: "unauthorized" }

  try {
    const { data: client, error } = await admin
      .from("clients")
      .select("id, auth_user_id, anonymized_at")
      .eq("id", clientId)
      .maybeSingle()
    if (error) return { ok: false, error: error.message }
    if (!client) return { ok: false, error: "client not found" }
    if (client.anonymized_at) return { ok: true } // already anonymized

    // 1. Delete the client's OWN uploads the artist isn't using/curating. Abort
    //    (don't stamp anonymized) if a file won't delete, so a retry finishes it.
    const { data: ownMedia } = await admin
      .from("client_media")
      .select("id, favorited_at")
      .eq("client_id", clientId)
      .eq("source", "client")
    for (const media of ownMedia ?? []) {
      if (await isArtistInUse(admin, media)) continue
      const purged = await purgeMediaArtifacts(media.id)
      if (!purged) return { ok: false, error: "storage delete failed — retry" }
      await admin.from("client_media").delete().eq("id", media.id)
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
    await admin
      .from("bookings")
      .update({ client_notes: null })
      .eq("client_id", clientId)
    const { error: scrubError } = await admin
      .from("clients")
      .update({
        name: null,
        phone: null,
        email: `redacted-${clientId}@anonymized.invalid`,
        auth_user_id: null,
        anonymized_at: new Date().toISOString(),
      })
      .eq("id", clientId)
    if (scrubError) return { ok: false, error: scrubError.message }

    revalidatePath(`/admin/clients/${clientId}`)
    revalidatePath("/admin/clients")
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "erasure failed" }
  }
}
