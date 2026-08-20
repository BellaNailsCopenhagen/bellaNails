"use server"

import { revalidatePath } from "next/cache"

import { requireOwner } from "@/lib/admin/require-owner"
import { revalidatePublicSurfaces } from "@/lib/admin/revalidate-surfaces"
import { deleteObject } from "@/lib/storage/scaleway"

export type AssetHubResult = { ok: true } | { ok: false; error: string }

/**
 * Bulk "add to website gallery" — one flow: a photo the client already consented
 * to (site) is placed on the clients_gallery surface right away; one that hasn't
 * gets a site consent request flagged to AUTO-PLACE the moment it's granted
 * (grantMediaConsentRow honours the flag). No per-item confirmation.
 */
export async function bulkAddToGallery(
  mediaIds: string[],
): Promise<AssetHubResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }
  if (!mediaIds.length) return { ok: true }

  const { data: media } = await supabase
    .from("client_media")
    .select("id, client_id")
    .in("id", mediaIds)
  const ownerByMedia = new Map((media ?? []).map((m) => [m.id, m.client_id]))

  const { data: consents } = await supabase
    .from("media_consents")
    .select("client_media_id, status, published_asset_id")
    .eq("purpose", "site")
    .in("client_media_id", mediaIds)
  const siteByMedia = new Map(
    (consents ?? []).map((c) => [c.client_media_id, c]),
  )

  for (const mediaId of mediaIds) {
    const consent = siteByMedia.get(mediaId)
    // Already granted → place the published copy; never re-ask (an unpublished
    // grant is a storage-retry, not a reason to reset the client's yes).
    if (consent?.status === "granted") {
      if (consent.published_asset_id) {
        await supabase.from("asset_usages").upsert(
          { asset_id: consent.published_asset_id, surface: "clients_gallery", url: null },
          { onConflict: "asset_id,surface" },
        )
      }
      continue
    }
    const clientId = ownerByMedia.get(mediaId)
    if (!clientId) continue
    const base = {
      client_media_id: mediaId,
      client_id: clientId,
      purpose: "site",
      status: "requested",
      requested_at: new Date().toISOString(),
      granted_at: null,
      declined_at: null,
      withdrawn_at: null,
      needs_takedown_at: null,
      published_asset_id: null,
    }
    await supabase
      .from("media_consents")
      .upsert(
        { ...base, auto_place: true },
        { onConflict: "client_media_id,purpose" },
      )
  }

  revalidatePath("/admin/assets")
  revalidatePublicSurfaces()
  return { ok: true }
}

/**
 * The artist confirms a withdrawn-but-live asset has been taken down (the manual
 * social removal) — now erase the kept published copy for real. Clears the
 * takedown flag so it leaves the "Used & withdrawn" tab.
 */
export async function confirmTakedown(
  consentId: string,
): Promise<AssetHubResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const { data: consent } = await supabase
    .from("media_consents")
    .select("published_asset_id")
    .eq("id", consentId)
    .maybeSingle()
  if (!consent) return { ok: false, error: "not_found" }

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
    // Deleting the asset cascades its asset_usages.
    await supabase.from("assets").delete().eq("id", consent.published_asset_id)
    if (asset?.storage_key) await deleteObject(asset.storage_key)
  }

  await supabase
    .from("media_consents")
    .update({ published_asset_id: null, needs_takedown_at: null })
    .eq("id", consentId)

  revalidatePath("/admin/assets")
  return { ok: true }
}

/** Heart (or un-heart) a photo — the artist's curation shortlist, available in
    any state, independent of consent. */
export async function setMediaFavorite(
  mediaId: string,
  favorite: boolean,
): Promise<AssetHubResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const { error } = await supabase
    .from("client_media")
    .update({ favorited_at: favorite ? new Date().toISOString() : null })
    .eq("id", mediaId)
  if (error) return { ok: false, error: "Couldn’t update." }

  revalidatePath("/admin/assets")
  return { ok: true }
}

/** Set aside (or restore) a client upload without deleting it — keeps the New
    tab to real pending work. The client's photo is untouched. */
export async function setMediaDismissed(
  mediaId: string,
  dismissed: boolean,
): Promise<AssetHubResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const { error } = await supabase
    .from("client_media")
    .update({ dismissed_at: dismissed ? new Date().toISOString() : null })
    .eq("id", mediaId)
  if (error) return { ok: false, error: "Couldn’t update." }

  revalidatePath("/admin/assets")
  return { ok: true }
}
