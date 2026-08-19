import "server-only"

import { presignedGet, storageConfigured } from "@/lib/storage/scaleway"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * The asset hub's read model — every client image across all clients, enriched
 * with consent + placement, and bucketed into one state for the hub's tabs.
 * Service-role, owner-gated route. Degrade-safe: missing tables → [].
 */

export type HubState =
  | "new"
  | "awaiting"
  | "unlinked"
  | "in_use"
  | "declined"
  | "withdrawn"
  | "takedown"
  | "dismissed"

export type HubUsage = { id: string; surface: string; url: string | null }

export type HubConsent = {
  id: string
  purpose: string // 'site' | 'some'
  status: string
  publishedAssetId: string | null
  needsTakedown: boolean
  usages: HubUsage[]
}

export type HubAsset = {
  mediaId: string
  clerkUserId: string
  url: string
  kind: string
  caption: string | null
  createdAt: string
  source: string
  dismissed: boolean
  favorited: boolean
  state: HubState
  /** Consent by purpose ('site' / 'some'). */
  consents: Record<string, HubConsent>
}

function deriveState(
  consents: HubConsent[],
  dismissed: boolean,
): HubState {
  if (consents.some((c) => c.needsTakedown)) return "takedown"
  if (consents.some((c) => c.usages.length > 0)) return "in_use"
  if (consents.some((c) => c.status === "granted")) return "unlinked"
  if (consents.some((c) => c.status === "requested")) return "awaiting"
  if (consents.some((c) => c.status === "declined")) return "declined"
  if (consents.some((c) => c.status === "withdrawn")) return "withdrawn"
  if (dismissed) return "dismissed"
  return "new"
}

type MediaRow = {
  id: string
  clerk_user_id: string
  url: string
  storage_key: string | null
  kind: string
  caption: string | null
  created_at: string
  source: string
  dismissed_at: string | null
  favorited_at?: string | null
}

export async function getHubAssets(clerkUserId?: string): Promise<HubAsset[]> {
  const supabase = createSupabaseServiceRoleClient()

  const q = supabase
    .from("client_media")
    .select(
      "id, clerk_user_id, url, storage_key, kind, caption, created_at, source, dismissed_at, favorited_at",
    )
    .is("archived_at", null)
  const { data, error } = await (
    clerkUserId ? q.eq("clerk_user_id", clerkUserId) : q
  ).order("created_at", { ascending: false })
  const media = (data ?? []) as MediaRow[]
  if (error || !media.length) return []

  const mediaIds = media.map((m) => m.id)
  const { data: consents } = await supabase
    .from("media_consents")
    .select(
      "id, client_media_id, purpose, status, published_asset_id, needs_takedown_at",
    )
    .in("client_media_id", mediaIds)

  const assetIds = (consents ?? [])
    .map((c) => c.published_asset_id)
    .filter((id): id is string => Boolean(id))
  const { data: usages } = assetIds.length
    ? await supabase
        .from("asset_usages")
        .select("id, asset_id, surface, url")
        .in("asset_id", assetIds)
    : { data: [] }

  const usagesByAsset = new Map<string, HubUsage[]>()
  for (const u of usages ?? []) {
    const list = usagesByAsset.get(u.asset_id) ?? []
    list.push({ id: u.id, surface: u.surface, url: u.url })
    usagesByAsset.set(u.asset_id, list)
  }

  const consentsByMedia = new Map<string, HubConsent[]>()
  for (const c of consents ?? []) {
    const list = consentsByMedia.get(c.client_media_id) ?? []
    list.push({
      id: c.id,
      purpose: c.purpose,
      status: c.status,
      publishedAssetId: c.published_asset_id,
      needsTakedown: Boolean(c.needs_takedown_at),
      usages: c.published_asset_id
        ? (usagesByAsset.get(c.published_asset_id) ?? [])
        : [],
    })
    consentsByMedia.set(c.client_media_id, list)
  }

  // Presign private-original view URLs in parallel.
  const configured = storageConfigured()
  const urlEntries = await Promise.all(
    media.map(async (m): Promise<[string, string]> => {
      let url = m.url
      if (configured && m.storage_key) {
        const signed = await presignedGet(m.storage_key)
        if (signed.ok) url = signed.data.url
      }
      return [m.id, url]
    }),
  )
  const urlByMedia = new Map(urlEntries)

  return media.map((m) => {
    const list = consentsByMedia.get(m.id) ?? []
    const consentsByPurpose: Record<string, HubConsent> = {}
    for (const c of list) consentsByPurpose[c.purpose] = c
    return {
      mediaId: m.id,
      clerkUserId: m.clerk_user_id,
      url: urlByMedia.get(m.id) ?? m.url,
      kind: m.kind,
      caption: m.caption,
      createdAt: m.created_at,
      source: m.source,
      dismissed: Boolean(m.dismissed_at),
      favorited: Boolean(m.favorited_at),
      state: deriveState(list, Boolean(m.dismissed_at)),
      consents: consentsByPurpose,
    }
  })
}
