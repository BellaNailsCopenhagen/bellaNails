import { listUsagesForAssets } from "@/db/asset-usages"
import { listAssetsForMedia } from "@/db/assets"
import type { Db } from "@/db/client"
import { listDataConsents } from "@/db/client-consents"
import { listMediaForClient } from "@/db/client-media"
import { signedViewUrl, storageConfigured } from "@/platform/storage/supabase"

/**
 * Client media + release reads, shared by admin (service-role) and the client's
 * own My Space view (RLS own-read). Media use is now a booking-level RELEASE, so
 * status is per (booking, purpose) — the gallery groups media by booking and
 * shows that booking's release state. Private images never leak: RLS shows a row
 * only to the owner or the client it belongs to; public surfaces read the
 * published copies in `assets` instead.
 */

// Reused for data consents too — "none" is the UI default for an un-requested one.
export type ConsentStatus =
  "none" | "requested" | "granted" | "declined" | "withdrawn"

/** One place a photo of this client is actually shown, and under which
    permission. `purpose` is the release the studio published it under; `surface`
    is where that copy sits. */
export type ClientMediaUse = { surface: string; purpose: string }

export type ClientMediaItem = {
  id: string
  kind: string
  url: string
  caption: string | null
  serviceId: string | null
  bookingId: string | null
  createdAt: string
  /** Empty means this photo is private to the studio and the client. */
  usedOn: ClientMediaUse[]
}

type Client = Db

export async function getClientMedia(
  supabase: Client,
  clientId: string,
): Promise<ClientMediaItem[]> {
  const media = await listMediaForClient(supabase, clientId)

  // Where each photo actually ended up. A client is entitled to know not just
  // what they allowed, but what was DONE with it — `assets` and `asset_usages`
  // are public-readable, so this needs no extra privilege.
  const assets = await listAssetsForMedia(
    supabase,
    media.map((m) => m.id),
  ).catch(() => [])
  const usages = await listUsagesForAssets(
    supabase,
    assets.map((a) => a.id),
  ).catch(() => [])
  const surfacesByAsset = new Map<string, string[]>()
  for (const usage of usages) {
    surfacesByAsset.set(usage.asset_id, [
      ...(surfacesByAsset.get(usage.asset_id) ?? []),
      usage.surface,
    ])
  }
  const usedByMedia = new Map<string, ClientMediaUse[]>()
  for (const asset of assets) {
    if (!asset.client_media_id) {
      continue
    }
    const uses = (surfacesByAsset.get(asset.id) ?? []).map((surface) => ({
      surface,
      purpose: asset.purpose ?? "website",
    }))
    if (!uses.length) {
      continue
    }
    usedByMedia.set(asset.client_media_id, [
      ...(usedByMedia.get(asset.client_media_id) ?? []),
      ...uses,
    ])
  }

  // Private objects have no public URL — resolve a short-lived presigned GET for
  // display. Degrades to the stored locator when storage isn't configured.
  const configured = storageConfigured()

  return Promise.all(
    media.map(async (m) => {
      let url = m.url
      if (configured && m.storage_key) {
        const signed = await signedViewUrl(m.storage_key)
        if (signed.ok) {
          url = signed.data.url
        }
      }

      return {
        id: m.id,
        kind: m.kind,
        url,
        caption: m.caption,
        serviceId: m.service_id,
        bookingId: m.booking_id,
        createdAt: m.created_at,
        usedOn: usedByMedia.get(m.id) ?? [],
      }
    }),
  )
}

export type DataConsentItem = { purpose: string; status: ConsentStatus }

export async function getClientDataConsents(
  supabase: Client,
  clientId: string,
): Promise<DataConsentItem[]> {
  const data = await listDataConsents(supabase, clientId)

  return data.map((c) => ({
    purpose: c.purpose,
    status: c.status as ConsentStatus,
  }))
}
