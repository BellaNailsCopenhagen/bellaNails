"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@clerk/nextjs/server"

import { isOwner } from "@/lib/admin/owner"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type AssetUsageResult = { ok: true } | { ok: false; error: string }

// Website surfaces need SITE consent; social needs SoMe consent — enforced by
// the caller passing only allowed surfaces, and re-listed here as the source of
// truth for valid values.
export const SURFACES = [
  "clients_gallery",
  "showcase",
  "testimonial",
  "some",
] as const
export type Surface = (typeof SURFACES)[number]

async function requireOwner() {
  const { userId, sessionClaims } = await auth()
  if (!userId || !isOwner(sessionClaims)) return null
  return createSupabaseServiceRoleClient()
}

/** Place an asset on a surface (or update its link) — idempotent per surface. */
export async function addAssetUsage(
  assetId: string,
  surface: string,
  url?: string | null,
): Promise<AssetUsageResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }
  if (!SURFACES.includes(surface as Surface)) {
    return { ok: false, error: "Unknown use-case." }
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
