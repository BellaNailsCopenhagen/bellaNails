import "server-only"

import type { Db } from "@/db/client"
import { insertNotification } from "@/db/owner-notifications"

export type OwnerNotificationKind =
  | "media_consent_withdrawn"
  | "media_consent_restored"
  | "shared_image_deleted"
  | "booking_request"
  | "design_request"
  | "design_reply"
  | "testimonial_submitted"

/**
 * Record a studio notification. Best-effort: a missing table or column
 * (pre-migration) must never fail the caller's primary action — but it is
 * LOGGED, because a swallowed insert means the artist is never told, and
 * nothing else would say so. Callers pass their own (service-role) client.
 *
 * `targetId` is the row the alert is about (a design request, a booking
 * request, a testimonial) — it is what turns the feed from a list of headlines
 * into links that land on the thing needing an answer.
 */
export async function notifyOwner(
  supabase: Db,
  input: {
    kind: OwnerNotificationKind
    clientId: string
    targetId?: string | null
    clientMediaId?: string | null
    purpose?: string | null
  },
): Promise<void> {
  const saved = await insertNotification(supabase, {
    kind: input.kind,
    client_id: input.clientId,
    target_id: input.targetId ?? null,
    client_media_id: input.clientMediaId ?? null,
    purpose: input.purpose ?? null,
  })
  if (!saved.ok) {
    console.error(`[notify] ${input.kind} alert not recorded:`, saved.message)
  }
}
