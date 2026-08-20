"use server"

import { revalidatePath } from "next/cache"

import { getCurrentUser } from "@/modules/identity/server"
import { notifyOwner } from "@/modules/notifications/notify"
import { revalidatePublicSurfaces } from "@/modules/media/revalidate-surfaces"
import { recordTermsAcceptance } from "@/modules/terms/acceptance"
import { deleteObject, publishToPublic } from "@/platform/storage/scaleway"
import type { MediaPurpose } from "@/modules/media/client-gallery"
import { listSurfacesForAsset, placeAsset, removeUsagesExceptSurface } from "@/db/asset-usages"
import { deleteAsset, getAssetStorageKey, insertAsset } from "@/db/assets"
import {
  findDataConsent,
  updateDataConsent,
  withdrawDataConsentFor,
} from "@/db/client-consents"
import { getMediaFile } from "@/db/client-media"
import { deleteGalleryItemsForAsset } from "@/db/gallery-items"
import {
  findConsent,
  findConsentWithAsset,
  getConsentAutoPlace,
  listRequestedFor,
  updateConsent,
} from "@/db/media-consents"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"

/**
 * The CLIENT's own consent decisions (from /bookings). Every action re-verifies
 * the caller owns the record (`client_id === signed-in client`) — the UI is
 * never the boundary. Granting an image runs copy-on-consent (a public storage
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
  const user = await getCurrentUser()
  return user?.id ?? null
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
  clientId: string,
  consentId: string,
  mediaId: string,
): Promise<{ note?: string }> {
  let publishedAssetId: string | null = null
  let note: string | undefined
  const media = await getMediaFile(supabase, mediaId)

  if (media?.storage_key) {
    const published = await publishToPublic(media.storage_key)
    if (published.ok) {
      const asset = await insertAsset(supabase, {
        url: published.data.url,
        media_type: media.kind ?? "image",
        storage_key: published.data.key,
      })
      publishedAssetId = asset.ok ? asset.id : null
    } else if (published.error === "not_configured") {
      note = "Consent saved — the image will publish once storage is set up."
    } else {
      note = "Consent saved — publishing the image failed, we’ll retry."
    }
  }

  await updateConsent(supabase, consentId, {
    status: "granted",
    granted_at: new Date().toISOString(),
    declined_at: null,
    withdrawn_at: null,
    published_asset_id: publishedAssetId,
  })

  // Granting publish consent accepts the current data-use terms for this photo —
  // record it at the media level so the studio can see exactly when. Best-effort.
  await recordTermsAcceptance(supabase, {
    clientId,
    kind: "data",
    context: "media_consent",
    referenceId: mediaId,
  })

  // Bulk "publish to gallery": if a SITE consent was flagged to auto-place, put
  // the freshly-published copy on the website gallery now, then clear the flag so
  // a later re-request can't silently republish. Best-effort — never fail the grant.
  if (publishedAssetId) {
    try {
      const flagged = await getConsentAutoPlace(supabase, consentId)
      if (flagged?.auto_place && flagged.purpose === "site") {
        await placeAsset(supabase, publishedAssetId, "clients_gallery", null)
        await updateConsent(supabase, consentId, { auto_place: false })
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

  const consent = await findConsent(supabase, mediaId, purpose)
  if (!consent || consent.client_id !== userId) {
    return { ok: false, error: "not_found" }
  }

  if (decision === "declined") {
    await updateConsent(supabase, consent.id, {
      status: "declined",
      declined_at: new Date().toISOString(),
      granted_at: null,
      withdrawn_at: null,
    })
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

  const mediaRows = await listRequestedFor(supabase, userId)

  let note: string | undefined
  for (const row of mediaRows) {
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

  const consent = await findConsentWithAsset(supabase, mediaId, purpose)
  if (!consent || consent.client_id !== userId) {
    return { ok: false, error: "not_found" }
  }

  const now = new Date().toISOString()

  // Is the published copy live on a MANUAL surface (social)? We can't take the
  // post down for them, so keep the copy + flag it for takedown ("Used &
  // withdrawn" in the hub); the artist erases it once the post is removed.
  const assetId = consent.published_asset_id
  let hasManualUse = false
  if (assetId) {
    const surfaces = await listSurfacesForAsset(supabase, assetId)
    hasManualUse = surfaces.includes("some")
  }

  if (assetId && hasManualUse) {
    // Keep the asset + its social usage; drop any auto (site) placements.
    await removeUsagesExceptSurface(supabase, assetId, "some")
    await updateConsent(supabase, consent.id, {
      status: "withdrawn",
      withdrawn_at: now,
      needs_takedown_at: now,
    })
  } else {
    // Nothing manual to take down — fully unpublish now (asset delete cascades
    // its placements; the private original in client_media is untouched).
    if (assetId) {
      const storageKey = await getAssetStorageKey(supabase, assetId)
      await deleteGalleryItemsForAsset(supabase, assetId)
      await deleteAsset(supabase, assetId)
      if (storageKey) await deleteObject(storageKey)
    }
    await updateConsent(supabase, consent.id, {
      status: "withdrawn",
      withdrawn_at: now,
      published_asset_id: null,
    })
  }

  await notifyOwner(supabase, {
    kind: "media_consent_withdrawn",
    clientId: userId,
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

  const consent = await findDataConsent(supabase, userId, purpose)
  if (!consent) return { ok: false, error: "not_found" }

  // Reset the sibling timestamps so a re-grant after a withdrawal/decline can't
  // leave a contradictory audit row (e.g. status=granted with a stale withdrawn_at).
  const now = new Date().toISOString()
  const stamp =
    decision === "granted"
      ? { granted_at: now, declined_at: null, withdrawn_at: null }
      : { declined_at: now, granted_at: null, withdrawn_at: null }
  await updateDataConsent(supabase, consent.id, { status: decision, ...stamp })
  revalidatePath(`/admin/clients/${userId}`)
  return { ok: true }
}

export async function withdrawDataConsent(
  purpose: DataPurpose,
): Promise<ConsentActionResult> {
  const userId = await callerId()
  if (!userId) return { ok: false, error: "unauthorized" }
  const supabase = createSupabaseServiceRoleClient()

  await withdrawDataConsentFor(supabase, userId, purpose)
  revalidatePath(`/admin/clients/${userId}`)
  return { ok: true }
}
