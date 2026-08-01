"use server"

import { revalidatePath } from "next/cache"

import { requireOwner } from "@/lib/admin/require-owner"
import { isAssetSurface, surfacesForPurpose } from "@/lib/asset-surfaces"

export type AssetUsageResult = { ok: true } | { ok: false; error: string }

/** Place an asset on a surface (or update its link) — idempotent per surface.
    Enforces consent scope server-side: the surface must be one the client's
    consent purpose allows (site → website surfaces, some → social). */
export async function addAssetUsage(
  assetId: string,
  surface: string,
  url?: string | null,
): Promise<AssetUsageResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }
  if (!isAssetSurface(surface)) return { ok: false, error: "Unknown use-case." }

  // The asset must be a published copy, and the surface must fall within what
  // the client actually consented to — never trust the UI's gating alone.
  const { data: consent } = await supabase
    .from("media_consents")
    .select("purpose")
    .eq("published_asset_id", assetId)
    .maybeSingle()
  if (!consent) return { ok: false, error: "Asset not found." }
  if (!surfacesForPurpose(consent.purpose).includes(surface)) {
    return {
      ok: false,
      error: "That use-case isn’t covered by the client’s consent.",
    }
  }

  const { error } = await supabase
    .from("asset_usages")
    .upsert(
      { asset_id: assetId, surface, url: url?.trim() || null },
      { onConflict: "asset_id,surface" },
    )
  if (error) return { ok: false, error: "Couldn’t save the use-case." }

  revalidatePath("/admin/assets")
  return { ok: true }
}

/** Remove an asset from a surface. */
export async function removeAssetUsage(
  usageId: string,
): Promise<AssetUsageResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const { error } = await supabase
    .from("asset_usages")
    .delete()
    .eq("id", usageId)
  if (error) return { ok: false, error: "Couldn’t remove the use-case." }

  revalidatePath("/admin/assets")
  return { ok: true }
}
