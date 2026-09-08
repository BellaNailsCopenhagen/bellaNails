import "server-only"

import type { Db } from "@/db/client"
import {
  deleteNotificationsForTarget,
  insertNotification,
} from "@/db/owner-notifications"

export type OwnerNotificationKind =
  | "media_consent_withdrawn"
  | "media_consent_restored"
  | "media_consent_offered"
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

/**
 * The mirror of `notifyOwner`: the row an alert pointed at has been decided, so
 * the alert has stopped being a question. Best-effort and LOGGED for the same
 * reason — a swallowed delete leaves a permanent "needs you" pointing at a
 * decided item, and a badge count that never reaches zero stops meaning
 * anything at all.
 */
export async function dismissOwnerNotifications(
  supabase: Db,
  input: { kind: OwnerNotificationKind; targetId: string },
): Promise<void> {
  const cleared = await deleteNotificationsForTarget(
    supabase,
    input.kind,
    input.targetId,
  )
  if (!cleared.ok) {
    console.error(
      `[notify] ${input.kind} alert for ${input.targetId} not dismissed:`,
      cleared.message,
    )
  }
}
