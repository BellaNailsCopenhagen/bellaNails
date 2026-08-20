import "server-only"

import type { Db } from "@/db/client"
import { insertNotification } from "@/db/owner-notifications"

export type OwnerNotificationKind =
  | "media_consent_withdrawn"
  | "shared_image_deleted"

/**
 * Record a studio notification. Best-effort: a missing table (pre-migration)
 * must never fail the caller's primary action, so the insert error is ignored.
 * Callers pass their own (service-role) client.
 */
export async function notifyOwner(
  supabase: Db,
  input: {
    kind: OwnerNotificationKind
    clientId: string
    clientMediaId?: string | null
    purpose?: string | null
  },
): Promise<void> {
  await insertNotification(supabase, {
    kind: input.kind,
    client_id: input.clientId,
    client_media_id: input.clientMediaId ?? null,
    purpose: input.purpose ?? null,
  })
}
