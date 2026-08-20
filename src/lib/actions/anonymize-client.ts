"use server"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"

import { requireOwner } from "@/lib/admin/require-owner"
import { getCurrentUser } from "@/lib/identity/server"
import { purgeMediaArtifacts } from "@/lib/media-erasure"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/types"

export type AnonymizeResult = { ok: true } | { ok: false; error: string }

type Admin = SupabaseClient<Database>

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
    const { data: client, error } = await admin
      .from("clients")
      .select("id, auth_user_id, anonymized_at")
      .eq("id", clientId)
      .maybeSingle()
    if (error) return { ok: false, error: error.message }
    if (!client) return { ok: false, error: "client not found" }
    if (client.anonymized_at) return { ok: true } // already anonymized

    // 1. Delete the client's OWN uploads the artist isn't using/curating.
    const { data: ownMedia } = await admin
      .from("client_media")
      .select("id, favorited_at")
      .eq("client_id", clientId)
      .eq("source", "client")
    for (const media of ownMedia ?? []) {
      if (await isArtistInUse(admin, media)) continue
      if (!(await purgeMediaArtifacts(media.id))) {
        return { ok: false, error: "storage delete failed — retry" }
      }
      const { error: delError } = await admin
        .from("client_media")
        .delete()
        .eq("id", media.id)
      if (delError) return { ok: false, error: delError.message }
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
    const { error: notesError } = await admin
      .from("bookings")
      .update({ client_notes: null })
      .eq("client_id", clientId)
    if (notesError) return { ok: false, error: notesError.message }
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
    revalidatePath(`/admin/clients/${clientId}`)
    revalidatePath("/admin/clients")
  }
  return result
}

/** A signed-in client erases their own account (My space). */
export async function deleteMyAccount(): Promise<AnonymizeResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "not signed in" }
  return runAnonymize(createSupabaseServiceRoleClient(), user.id)
}
