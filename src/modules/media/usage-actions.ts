"use server"

import { revalidatePath } from "next/cache"

import { placeAsset, removeUsage } from "@/db/asset-usages"
import { getAssetPurpose } from "@/db/assets"
import { requireOwner } from "@/modules/identity/require-owner"
import { revalidatePublicSurfaces } from "@/modules/media/revalidate-surfaces"
import {
  isAssetSurface,
  isPublicSurface,
  surfacesForPurpose,
} from "@/shared/asset-surfaces"
import { routes } from "@/shared/routes"

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
  // the client actually released — never trust the UI's gating alone.
  const purpose = await getAssetPurpose(supabase, assetId)
  if (!purpose) return { ok: false, error: "Asset not found." }
  if (!surfacesForPurpose(purpose).includes(surface)) {
    return {
      ok: false,
      error: "That use-case isn’t covered by the client’s consent.",
    }
  }

  const saved = await placeAsset(supabase, assetId, surface, url?.trim() || null)
  if (!saved.ok) return { ok: false, error: "Couldn’t save the use-case." }

  revalidatePath(routes.admin.assets)
  if (isPublicSurface(surface)) revalidatePublicSurfaces()
  return { ok: true }
}

/** Remove an asset from a surface. */
export async function removeAssetUsage(
  usageId: string,
): Promise<AssetUsageResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  // Return the removed row's surface so we only churn the public pages when the
  // placement was one they actually render.
  const removed = await removeUsage(supabase, usageId)
  if (!removed.ok) return { ok: false, error: "Couldn’t remove the use-case." }

  revalidatePath(routes.admin.assets)
  if (removed.surface && isPublicSurface(removed.surface)) {
    revalidatePublicSurfaces()
  }
  return { ok: true }
}
