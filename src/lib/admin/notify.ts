import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/platform/supabase/types"

export type OwnerNotificationKind =
  | "media_consent_withdrawn"
  | "shared_image_deleted"

/**
 * Record a studio notification. Best-effort: a missing table (pre-migration)
 * must never fail the caller's primary action, so the insert error is ignored.
 * Callers pass their own (service-role) client.
 */
export async function notifyOwner(
  supabase: SupabaseClient<Database>,
  input: {
    kind: OwnerNotificationKind
    clientId: string
    clientMediaId?: string | null
    purpose?: string | null
  },
): Promise<void> {
  await supabase.from("owner_notifications").insert({
    kind: input.kind,
    client_id: input.clientId,
    client_media_id: input.clientMediaId ?? null,
    purpose: input.purpose ?? null,
  })
}
