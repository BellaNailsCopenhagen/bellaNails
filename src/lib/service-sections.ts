import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/types"
import { firstOf } from "@/lib/utils"

type Client = SupabaseClient<Database>

export type ServiceSection = {
  id: string
  sortOrder: number
  titleEn: string | null
  titleDk: string | null
  bodyEn: string | null
  bodyDk: string | null
  assetId: string | null
  imageUrl: string | null
}

type SectionRow = {
  id: string
  sort_order: number
  title_en: string | null
  title_dk: string | null
  body_en: string | null
  body_dk: string | null
  asset_id: string | null
  asset: { url: string } | { url: string }[] | null
}

/** A service's content sections, ordered — with each section's image URL. */
export async function getServiceSections(
  supabase: Client,
  serviceId: string,
): Promise<ServiceSection[]> {
  const { data, error } = await supabase
    .from("service_sections")
    .select(
      "id, sort_order, title_en, title_dk, body_en, body_dk, asset_id, asset:assets(url)",
    )
    .eq("service_id", serviceId)
    .order("sort_order", { ascending: true })
  if (error || !data) return []
  return (data as SectionRow[]).map((row) => {
    const asset = firstOf(row.asset)
    return {
      id: row.id,
      sortOrder: row.sort_order,
      titleEn: row.title_en,
      titleDk: row.title_dk,
      bodyEn: row.body_en,
      bodyDk: row.body_dk,
      assetId: row.asset_id,
      imageUrl: asset?.url ?? null,
    }
  })
}

export type PickableAsset = { id: string; url: string }

/**
 * The pool the image picker offers under "use one from the shared gallery":
 * public copies the client consented to publish ON THE WEBSITE (purpose = site).
 * A social-only consent must NOT be pickable here — section images render on the
 * public site. Two plain queries (consents → asset ids → assets) since the FK
 * isn't in the hand-maintained types. Deduplicated across any duplicate rows.
 */
export async function getConsentedAssets(
  supabase: Client,
): Promise<PickableAsset[]> {
  const { data: consents } = await supabase
    .from("media_consents")
    .select("published_asset_id")
    .eq("purpose", "site")
    .eq("status", "granted")
    .not("published_asset_id", "is", null)

  const ids = [
    ...new Set(
      (consents ?? [])
        .map((c) => c.published_asset_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  if (!ids.length) return []

  const { data: assets } = await supabase
    .from("assets")
    .select("id, url")
    .in("id", ids)
  return (assets ?? []).map((a) => ({ id: a.id, url: a.url }))
}
