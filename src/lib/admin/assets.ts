import "server-only"

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * Shared-asset overview for admin: every image a client has approved for
 * publishing, newest first, with where it's currently placed (asset_usages).
 * "Unlinked" = approved but placed nowhere yet — the artist decides. Service-
 * role, owner-gated route. Degrade-safe: missing tables return [].
 */

export type AssetUsage = { id: string; surface: string; url: string | null }

export type SharedAsset = {
  assetId: string
  url: string
  clerkUserId: string
  /** 'site' → website surfaces allowed; 'some' → social. */
  purpose: string
  grantedAt: string | null
  usages: AssetUsage[]
}

export async function getSharedAssets(): Promise<SharedAsset[]> {
  const supabase = createSupabaseServiceRoleClient()

  const { data: consents, error } = await supabase
    .from("media_consents")
    .select("purpose, granted_at, published_asset_id, clerk_user_id")
    .eq("status", "granted")
    .not("published_asset_id", "is", null)
    .order("granted_at", { ascending: false })
  if (error || !consents?.length) return []

  const assetIds = consents
    .map((c) => c.published_asset_id)
    .filter((id): id is string => Boolean(id))

  const [assetsRes, usagesRes] = await Promise.all([
    supabase.from("assets").select("id, url").in("id", assetIds),
    supabase
      .from("asset_usages")
      .select("id, asset_id, surface, url")
      .in("asset_id", assetIds),
  ])

  const urlById = new Map((assetsRes.data ?? []).map((a) => [a.id, a.url]))
  const usagesByAsset = new Map<string, AssetUsage[]>()
  for (const u of usagesRes.data ?? []) {
    const list = usagesByAsset.get(u.asset_id) ?? []
    list.push({ id: u.id, surface: u.surface, url: u.url })
    usagesByAsset.set(u.asset_id, list)
  }

  return consents
    .filter((c) => c.published_asset_id && urlById.has(c.published_asset_id))
    .map((c) => ({
      assetId: c.published_asset_id as string,
      url: urlById.get(c.published_asset_id as string) as string,
      clerkUserId: c.clerk_user_id,
      purpose: c.purpose,
      grantedAt: c.granted_at,
      usages: usagesByAsset.get(c.published_asset_id as string) ?? [],
    }))
}
