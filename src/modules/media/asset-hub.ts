import "server-only"

import { listUsagesForAssets } from "@/db/asset-usages"
import { listAssetsForMedia } from "@/db/assets"
import { listHubMedia } from "@/db/client-media"
import { listReleasesForBookings } from "@/db/media-releases"
import { signedViewUrl, storageConfigured } from "@/platform/storage/supabase"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"
import { RELEASE_PURPOSES } from "@/shared/media-release"

/**
 * The asset hub's read model — every client image/video across all clients,
 * enriched with its booking-level RELEASE state (per purpose) + any published
 * public copies and their placements, bucketed into one state for the hub tabs.
 * Service-role, owner-gated route. Degrade-safe: missing tables → [].
 */

export type HubState =
  | "new"
  | "awaiting"
  | "granted"
  | "published"
  | "in_use"
  | "declined"
  | "withdrawn"
  | "takedown"
  | "dismissed"

export type HubUsage = { id: string; surface: string; url: string | null }

/** A published public copy of this original, for one purpose (website/social). */
export type HubPublished = {
  assetId: string
  purpose: string
  needsTakedown: boolean
  usages: HubUsage[]
}

export type HubAsset = {
  mediaId: string
  clientId: string
  bookingId: string | null
  url: string
  kind: string
  caption: string | null
  createdAt: string
  dismissed: boolean
  favorited: boolean
  state: HubState
  /** Booking-level release status by purpose (website/social/education). */
  releases: Record<string, string>
  published: HubPublished[]
}

function deriveState(
  releases: Record<string, string>,
  published: HubPublished[],
  dismissed: boolean,
): HubState {
  // This media's OWN publication wins first — releases are booking-level (shared
  // by every photo of the booking), so a pending request for one purpose must not
  // mask a photo that's already live for another.
  if (published.some((p) => p.needsTakedown)) return "takedown"
  if (published.some((p) => p.usages.length > 0)) return "in_use"
  if (published.length > 0) return "published"
  const statuses = Object.values(releases)
  if (statuses.includes("granted")) return "granted"
  if (statuses.includes("requested")) return "awaiting"
  if (statuses.includes("declined")) return "declined"
  if (statuses.includes("withdrawn")) return "withdrawn"
  if (dismissed) return "dismissed"
  return "new"
}

export async function getHubAssets(clientId?: string): Promise<HubAsset[]> {
  const supabase = createSupabaseServiceRoleClient()

  const media = await listHubMedia(supabase, clientId)
  if (!media.length) return []

  const releaseRows = await listReleasesForBookings(
    supabase,
    media.map((m) => m.booking_id ?? "").filter(Boolean),
  )
  const releasesByBooking = new Map<string, Record<string, string>>()
  const blank = () =>
    Object.fromEntries(RELEASE_PURPOSES.map((p) => [p, "none"])) as Record<
      string,
      string
    >
  for (const r of releaseRows) {
    const cur = releasesByBooking.get(r.booking_id) ?? blank()
    cur[r.purpose] = r.status
    releasesByBooking.set(r.booking_id, cur)
  }

  const assets = await listAssetsForMedia(
    supabase,
    media.map((m) => m.id),
  )
  const usages = await listUsagesForAssets(
    supabase,
    assets.map((a) => a.id),
  )
  const usagesByAsset = new Map<string, HubUsage[]>()
  for (const u of usages) {
    const list = usagesByAsset.get(u.asset_id) ?? []
    list.push({ id: u.id, surface: u.surface, url: u.url })
    usagesByAsset.set(u.asset_id, list)
  }

  const publishedByMedia = new Map<string, HubPublished[]>()
  for (const a of assets) {
    if (!a.client_media_id) continue
    const list = publishedByMedia.get(a.client_media_id) ?? []
    list.push({
      assetId: a.id,
      purpose: a.purpose ?? "website",
      needsTakedown: Boolean(a.needs_takedown_at),
      usages: usagesByAsset.get(a.id) ?? [],
    })
    publishedByMedia.set(a.client_media_id, list)
  }

  // Presign private-original view URLs in parallel.
  const configured = storageConfigured()
  const urlEntries = await Promise.all(
    media.map(async (m): Promise<[string, string]> => {
      let url = m.url
      if (configured && m.storage_key) {
        const signed = await signedViewUrl(m.storage_key)
        if (signed.ok) url = signed.data.url
      }
      return [m.id, url]
    }),
  )
  const urlByMedia = new Map(urlEntries)

  return media.map((m) => {
    const releases = (m.booking_id && releasesByBooking.get(m.booking_id)) || blank()
    const published = publishedByMedia.get(m.id) ?? []
    return {
      mediaId: m.id,
      clientId: m.client_id,
      bookingId: m.booking_id,
      url: urlByMedia.get(m.id) ?? m.url,
      kind: m.kind,
      caption: m.caption,
      createdAt: m.created_at,
      dismissed: Boolean(m.dismissed_at),
      favorited: Boolean(m.favorited_at),
      state: deriveState(releases, published, Boolean(m.dismissed_at)),
      releases,
      published,
    }
  })
}
