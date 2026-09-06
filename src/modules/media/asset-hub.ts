import "server-only"

import { listUsagesForAssets } from "@/db/asset-usages"
import { listBookingLabelsByIds } from "@/db/bookings"
import { listAssetsForMedia } from "@/db/assets"
import { listHubMedia } from "@/db/client-media"
import { listReleasesForBookings } from "@/db/media-releases"
import { signedViewUrl, storageConfigured } from "@/platform/storage/supabase"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"
import { metaOf } from "@/shared/booking-policy"
import { deriveAssetState, type AssetState } from "@/shared/asset-state"
import { bookingRef, RELEASE_PURPOSES } from "@/shared/media-release"

/**
 * The asset hub's read model — every client image/video across all clients,
 * enriched with its booking-level RELEASE state (per purpose) + any published
 * public copies and their placements, reduced to the one state the hub tabs
 * read (shared/asset-state.ts owns that rule).
 * Service-role, owner-gated route. Degrade-safe: missing tables → [].
 */

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
  /** The artist's own "not using this one" — her filing, not the client's
      answer, so it never enters the appointment's state. */
  setAside: boolean
  favorited: boolean
  /** Booking-level release status by purpose (website/social/education). */
  releases: Record<string, string>
  published: HubPublished[]
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
      setAside: Boolean(m.dismissed_at),
      favorited: Boolean(m.favorited_at),
      releases,
      published,
    }
  })
}

/**
 * One appointment, its permissions, and the photos taken at it — the shape the
 * hub actually renders.
 *
 * A photo has no permission of its own: `media_releases` is keyed (booking,
 * purpose), so one answer covers every photo of that appointment. The hub used
 * to show a flat grid where each photo wore its booking's answer, which is why a
 * single photo could read "declined" when it was the APPOINTMENT that had been
 * declined. Grouping puts the answer back on the thing that was asked.
 */
export type HubAppointment = {
  /** Stable identity for a card — a booking id, or the orphan bucket's. Derived
      once here so a list and its React keys can't disagree about it. */
  key: string
  /** Null for the orphans — photos never linked to an appointment, which can
      therefore never be published. Collected under one card so they are visible
      instead of scattered. */
  bookingId: string | null
  clientId: string
  startIso: string | null
  ref: string
  serviceNameEn: string | null
  serviceNameDk: string | null
  /** The one set of answers, by purpose, covering every photo below. */
  releases: Record<string, string>
  photos: HubAsset[]
  state: AssetState
}

export async function getHubAppointments(
  clientId?: string,
): Promise<HubAppointment[]> {
  const assets = await getHubAssets(clientId)
  if (!assets.length) return []

  // Photos with no appointment are still someone's — keyed per client, or two
  // people's orphans would share one card under whichever name came first.
  const byBooking = new Map<string, HubAsset[]>()
  for (const asset of assets) {
    const key = asset.bookingId ?? `unlinked:${asset.clientId}`
    const group = byBooking.get(key)
    if (group) group.push(asset)
    else byBooking.set(key, [asset])
  }

  const labels = await listBookingLabelsByIds(
    createSupabaseServiceRoleClient(),
    [...byBooking.keys()].filter((key) => !key.startsWith("unlinked:")),
  )
  const labelById = new Map(labels.map((b) => [b.id, b]))

  return [...byBooking.entries()]
    .map(([key, photos]): HubAppointment => {
      const bookingId = key.startsWith("unlinked:") ? null : key
      const booking = bookingId ? labelById.get(bookingId) : undefined
      const meta = booking ? metaOf(booking) : {}
      // Every photo of one appointment shares its releases; the appointment's
      // state reads them together with what any of its photos has published.
      const releases = photos[0].releases
      return {
        key,
        bookingId,
        clientId: photos[0].clientId,
        startIso: booking?.start_time ?? null,
        ref: bookingId ? bookingRef(bookingId) : "",
        serviceNameEn: meta.serviceNameEn ?? null,
        serviceNameDk: meta.serviceNameDk ?? null,
        releases,
        photos,
        state: deriveAssetState(
          releases,
          photos.flatMap((photo) =>
            photo.published.map((copy) => ({
              purpose: copy.purpose,
              needsTakedown: copy.needsTakedown,
              placements: copy.usages.length,
            })),
          ),
          bookingId !== null,
        ),
      }
    })
    .sort((a, b) => (b.startIso ?? "").localeCompare(a.startIso ?? ""))
}
