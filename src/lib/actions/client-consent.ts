"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@clerk/nextjs/server"

import { notifyOwner } from "@/lib/admin/notify"
import { revalidatePublicSurfaces } from "@/lib/admin/revalidate-surfaces"
import { recordTermsAcceptance } from "@/lib/terms-acceptance"
import { deleteObject, publishToPublic } from "@/lib/storage/scaleway"
import type { MediaPurpose } from "@/lib/media"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * The CLIENT's own consent decisions (from /bookings). Every action re-verifies
 * the caller owns the record (`clerk_user_id === auth sub`) — the UI is never
 * the boundary. Granting an image runs copy-on-consent (a public storage
 * copy + a gallery item for the site); withdrawing deletes that copy. When
 * storage isn't configured yet, consent is still recorded and publishing is
 * deferred (reported back), per the "don't block on missing keys" rule.
 */

export type ConsentActionResult =
  | { ok: true; note?: string }
  | { ok: false; error: string }

type DataPurpose =
  | "testimonial_site"
  | "testimonial_some"
  | "name_site"
  | "name_some"

type ServiceClient = ReturnType<typeof createSupabaseServiceRoleClient>

async function callerId(): Promise<string | null> {
  const { userId } = await auth()
  return userId ?? null
}

/**
 * Grant one media consent: run copy-on-consent (a public copy in `assets`,
 * placed nowhere until the artist assigns a use-case) and mark the row granted.
 * Returns an optional note when publishing was deferred or failed — the consent
 * is still recorded either way. Shared by the single-decision and accept-all
 * paths so the publish logic lives in one place.
 */
async function grantMediaConsentRow(
  supabase: ServiceClient,
  clerkUserId: string,
  consentId: string,
  mediaId: string,
): Promise<{ note?: string }> {
  let publishedAssetId: string | null = null
  let note: string | undefined
  const { data: media } = await supabase
    .from("client_media")
    .select("storage_key, kind")
    .eq("id", mediaId)
    .maybeSingle()

  if (media?.storage_key) {
    const published = await publishToPublic(media.storage_key)
    if (published.ok) {
      const { data: asset } = await supabase
        .from("assets")
        .insert({
          url: published.data.url,
          media_type: media.kind ?? "image",
          storage_key: published.data.key,
        })
        .select("id")
        .single()
      publishedAssetId = asset?.id ?? null
    } else if (published.error === "not_configured") {
      note = "Consent saved — the image will publish once storage is set up."
    } else {
      note = "Consent saved — publishing the image failed, we’ll retry."
    }
  }

  await supabase
    .from("media_consents")
    .update({
      status: "granted",
      granted_at: new Date().toISOString(),
      declined_at: null,
      withdrawn_at: null,
      published_asset_id: publishedAssetId,
    })
    .eq("id", consentId)

  // Granting publish consent accepts the current data-use terms for this photo —
  // record it at the media level so the studio can see exactly when. Best-effort.
  await recordTermsAcceptance(supabase, {
    clerkUserId,
    kind: "data",
    context: "media_consent",
    referenceId: mediaId,
  })

  // Bulk "publish to gallery": if a SITE consent was flagged to auto-place, put
  // the freshly-published copy on the website gallery now, then clear the flag so
  // a later re-request can't silently republish. Best-effort — never fail the grant.
  if (publishedAssetId) {
    try {
      const { data: flagged } = await supabase
        .from("media_consents")
        .select("auto_place, purpose")
        .eq("id", consentId)
        .maybeSingle()
      if (flagged?.auto_place && flagged.purpose === "site") {
        await supabase.from("asset_usages").upsert(
          { asset_id: publishedAssetId, surface: "clients_gallery", url: null },
          { onConflict: "asset_id,surface" },
        )
        await supabase
          .from("media_consents")
          .update({ auto_place: false })
          .eq("id", consentId)
        revalidatePublicSurfaces()
      }
    } catch {
      // auto_place column may not exist yet — skip.
    }
  }
  return { note }
}

export async function decideMediaConsent(
  mediaId: string,
  purpose: MediaPurpose,
  decision: "granted" | "declined",
): Promise<ConsentActionResult> {
  const userId = await callerId()
  if (!userId) return { ok: false, error: "unauthorized" }
  const supabase = createSupabaseServiceRoleClient()

  const { data: consent } = await supabase
    .from("media_consents")
    .select("id, clerk_user_id, status")
    .eq("client_media_id", mediaId)
    .eq("purpose", purpose)
    .maybeSingle()
  if (!consent || consent.clerk_user_id !== userId) {
    return { ok: false, error: "not_found" }
  }

  if (decision === "declined") {
    await supabase
      .from("media_consents")
      .update({
        status: "declined",
        declined_at: new Date().toISOString(),
        granted_at: null,
        withdrawn_at: null,
      })
      .eq("id", consent.id)
    revalidatePath(`/admin/clients/${userId}`)
    return { ok: true }
  }

  // Granted → publish a public copy (copy-on-consent), placed nowhere yet.
  const { note } = await grantMediaConsentRow(
    supabase,
    userId,
    consent.id,
    mediaId,
  )
  revalidatePath(`/admin/clients/${userId}`)
  return { ok: true, note }
}

/**
 * Accept every pending PHOTO request in one go from the client's Requests tab.
 * Deliberately photo-only: personal-data / testimonial consent (name, words)
 * stays a per-item decision — GDPR discourages bundling distinct purposes under
 * one blanket accept. Declines are always per-item too.
 */
export async function acceptAllPendingConsents(): Promise<ConsentActionResult> {
  const userId = await callerId()
  if (!userId) return { ok: false, error: "unauthorized" }
  const supabase = createSupabaseServiceRoleClient()

  const { data: mediaRows } = await supabase
    .from("media_consents")
    .select("id, client_media_id")
    .eq("clerk_user_id", userId)
    .eq("status", "requested")

  let note: string | undefined
  for (const row of mediaRows ?? []) {
    const result = await grantMediaConsentRow(
      supabase,
      userId,
      row.id,
      row.client_media_id,
    )
    if (result.note) note = result.note // surface the last deferral, if any
  }

  revalidatePath(`/admin/clients/${userId}`)
  return { ok: true, note }
}

export async function withdrawMediaConsent(
  mediaId: string,
  purpose: MediaPurpose,
): Promise<ConsentActionResult> {
  const userId = await callerId()
  if (!userId) return { ok: false, error: "unauthorized" }
  const supabase = createSupabaseServiceRoleClient()

  const { data: consent } = await supabase
    .from("media_consents")
    .select("id, clerk_user_id, published_asset_id")
    .eq("client_media_id", mediaId)
    .eq("purpose", purpose)
    .maybeSingle()
  if (!consent || consent.clerk_user_id !== userId) {
    return { ok: false, error: "not_found" }
  }

  const now = new Date().toISOString()

  // Is the published copy live on a MANUAL surface (social)? We can't take the
  // post down for them, so keep the copy + flag it for takedown ("Used &
  // withdrawn" in the hub); the artist erases it once the post is removed.
  const assetId = consent.published_asset_id
  let hasManualUse = false
  if (assetId) {
    const { data: usages } = await supabase
      .from("asset_usages")
      .select("surface")
      .eq("asset_id", assetId)
    hasManualUse = (usages ?? []).some((u) => u.surface === "some")
  }

  if (assetId && hasManualUse) {
    // Keep the asset + its social usage; drop any auto (site) placements.
    await supabase
      .from("asset_usages")
      .delete()
      .eq("asset_id", assetId)
      .neq("surface", "some")
    await supabase
      .from("media_consents")
      .update({ status: "withdrawn", withdrawn_at: now, needs_takedown_at: now })
      .eq("id", consent.id)
  } else {
    // Nothing manual to take down — fully unpublish now (asset delete cascades
    // its placements; the private original in client_media is untouched).
    if (assetId) {
      const { data: asset } = await supabase
        .from("assets")
        .select("storage_key")
        .eq("id", assetId)
        .maybeSingle()
      await supabase
        .from("gallery_items")
        .delete()
        .eq("primary_asset_id", assetId)
      await supabase.from("assets").delete().eq("id", assetId)
      if (asset?.storage_key) await deleteObject(asset.storage_key)
    }
    await supabase
      .from("media_consents")
      .update({ status: "withdrawn", withdrawn_at: now, published_asset_id: null })
      .eq("id", consent.id)
  }

  await notifyOwner(supabase, {
    kind: "media_consent_withdrawn",
    clerkUserId: userId,
    clientMediaId: mediaId,
    purpose,
  })

  revalidatePath(`/admin/clients/${userId}`)
  revalidatePath("/admin/assets")
  revalidatePublicSurfaces() // withdrawal drops any public placements
  return { ok: true }
}

export async function decideDataConsent(
  purpose: DataPurpose,
  decision: "granted" | "declined",
): Promise<ConsentActionResult> {
  const userId = await callerId()
  if (!userId) return { ok: false, error: "unauthorized" }
  const supabase = createSupabaseServiceRoleClient()

  const { data: consent } = await supabase
    .from("client_consents")
    .select("id, clerk_user_id")
    .eq("clerk_user_id", userId)
    .eq("purpose", purpose)
    .maybeSingle()
  if (!consent) return { ok: false, error: "not_found" }

  // Reset the sibling timestamps so a re-grant after a withdrawal/decline can't
  // leave a contradictory audit row (e.g. status=granted with a stale withdrawn_at).
  const now = new Date().toISOString()
  const stamp =
    decision === "granted"
      ? { granted_at: now, declined_at: null, withdrawn_at: null }
      : { declined_at: now, granted_at: null, withdrawn_at: null }
  await supabase
    .from("client_consents")
    .update({ status: decision, ...stamp })
    .eq("id", consent.id)
  revalidatePath(`/admin/clients/${userId}`)
  return { ok: true }
}

export async function withdrawDataConsent(
  purpose: DataPurpose,
): Promise<ConsentActionResult> {
  const userId = await callerId()
  if (!userId) return { ok: false, error: "unauthorized" }
  const supabase = createSupabaseServiceRoleClient()

  await supabase
    .from("client_consents")
    .update({ status: "withdrawn", withdrawn_at: new Date().toISOString() })
    .eq("clerk_user_id", userId)
    .eq("purpose", purpose)
  revalidatePath(`/admin/clients/${userId}`)
  return { ok: true }
}
