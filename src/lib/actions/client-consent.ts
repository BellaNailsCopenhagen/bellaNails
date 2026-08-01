"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@clerk/nextjs/server"

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

async function callerId(): Promise<string | null> {
  const { userId } = await auth()
  return userId ?? null
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

  // Granted → publish a public copy (copy-on-consent).
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
      if (publishedAssetId && purpose === "site") {
        await supabase.from("gallery_items").insert({
          primary_asset_id: publishedAssetId,
          display_mode: "single",
        })
      }
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
    .eq("id", consent.id)
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

  // Unpublish: delete the gallery item, the public copy row, and the stored
  // file. The private original in client_media is untouched.
  if (consent.published_asset_id) {
    const { data: asset } = await supabase
      .from("assets")
      .select("storage_key")
      .eq("id", consent.published_asset_id)
      .maybeSingle()
    await supabase
      .from("gallery_items")
      .delete()
      .eq("primary_asset_id", consent.published_asset_id)
    await supabase.from("assets").delete().eq("id", consent.published_asset_id)
    if (asset?.storage_key) {
      await deleteObject(asset.storage_key)
    }
  }

  await supabase
    .from("media_consents")
    .update({
      status: "withdrawn",
      withdrawn_at: new Date().toISOString(),
      published_asset_id: null,
    })
    .eq("id", consent.id)

  // Tell the studio: the site copy is auto-removed, but a SOCIAL post has to be
  // taken down by hand. Degrade-safe — a missing table must not fail withdrawal.
  await supabase.from("owner_notifications").insert({
    kind: "media_consent_withdrawn",
    clerk_user_id: userId,
    client_media_id: mediaId,
    purpose,
  })

  revalidatePath(`/admin/clients/${userId}`)
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
