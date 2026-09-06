"use server"

import { revalidatePath } from "next/cache"

import { getCurrentUser } from "@/modules/identity/server"
import {
  findDataConsent,
  updateDataConsent,
  withdrawDataConsentFor,
} from "@/db/client-consents"
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

export async function withdrawDataConsent(
  purpose: DataConsentPurpose,
): Promise<ConsentActionResult> {
  const userId = await callerId()
  if (!userId) return { ok: false, error: "unauthorized" }
  const supabase = createSupabaseServiceRoleClient()

  await withdrawDataConsentFor(supabase, userId, purpose)
  revalidatePath(routes.admin.client(userId))
  return { ok: true }
}
