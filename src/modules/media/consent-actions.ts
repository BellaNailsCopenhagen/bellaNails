"use server"

import { revalidatePath } from "next/cache"

import { getCurrentUser } from "@/modules/identity/server"
import {
  findDataConsent,
  updateDataConsent,
  withdrawDataConsentFor,
} from "@/db/client-consents"
import { notifyOwner } from "@/modules/notifications/notify"
import { revalidatePublicSurfaces } from "@/modules/revalidate"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"
import type { DataConsentPurpose } from "@/shared/data-consent"
import { routes } from "@/shared/routes"

/**
 * The CLIENT's own DATA consent decisions (name / testimonial) from My Space.
 * Media use is now a booking-level RELEASE — see release-actions.ts. Every action
 * re-verifies the caller owns the record; the UI is never the boundary.
 */

export type ConsentActionResult =
  | { ok: true; note?: string }
  | { ok: false; error: string }


async function callerId(): Promise<string | null> {
  const user = await getCurrentUser()
  return user?.id ?? null
}

export async function decideDataConsent(
  purpose: DataConsentPurpose,
  decision: "granted" | "declined",
): Promise<ConsentActionResult> {
  const userId = await callerId()
  if (!userId) return { ok: false, error: "unauthorized" }
  const supabase = createSupabaseServiceRoleClient()

  const consent = await findDataConsent(supabase, userId, purpose)
  if (!consent) return { ok: false, error: "not_found" }

  // `withdrawn_at` is NOT cleared on a re-grant: it records that the client once
  // took their permission back, and the accountability story depends on it
  // surviving — `status` alone says what is true now. Every release path holds
  // the same rule. The other two are cleared, so no row claims both a grant and
  // a decline.
  const now = new Date().toISOString()
  const stamp =
    decision === "granted"
      ? { granted_at: now, declined_at: null }
      : { declined_at: now, granted_at: null }
  await updateDataConsent(supabase, consent.id, { status: decision, ...stamp })
  revalidatePath(routes.admin.client(userId))
  return { ok: true }
}

/**
 * The client takes back permission to use their name or their words.
 *
 * Notifies the studio and revalidates the public surfaces, the way
 * `withdrawMediaConsent` does. Latent today — nothing public reads
 * `client_consents` yet — and that is exactly why it is worth being right now:
 * a withdrawal that quietly fails to take content down is the kind of bug that
 * ships the day the render does, with a GDPR obligation attached (Art. 7(3):
 * withdrawal must be as easy as giving it, and it must actually take effect).
 *
 * Notifying is best-effort, like every other `notifyOwner` — the client's
 * withdrawal must land whether or not the studio's inbox does.
 */
export async function withdrawDataConsent(
  purpose: DataConsentPurpose,
): Promise<ConsentActionResult> {
  const userId = await callerId()
  if (!userId) return { ok: false, error: "unauthorized" }
  const supabase = createSupabaseServiceRoleClient()

  await withdrawDataConsentFor(supabase, userId, purpose)

  await notifyOwner(supabase, {
    kind: "data_consent_withdrawn",
    clientId: userId,
    purpose,
  })

  revalidatePath(routes.admin.client(userId))
  revalidatePublicSurfaces()
  return { ok: true }
}
