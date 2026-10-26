"use server"

import { revalidatePath } from "next/cache"

import { removeUsage, setUsageLink } from "@/db/asset-usages"
import { getAssetPurpose } from "@/db/assets"
import { requireOwner } from "@/modules/identity/require-owner"
import { retireAssetIfUnused } from "@/modules/media/retire-asset"
import { revalidatePublicSurfaces } from "@/modules/revalidate"
import { isPublicSurface } from "@/shared/asset-surfaces"
import { routes } from "@/shared/routes"

export type AssetUsageResult = { ok: true } | { ok: false; error: string }

/**
 * Record where a social placement actually went — the link to the post.
 *
 * PLACING lives in asset-actions.ts, because it also makes the public copy.
 * Removing the last thing that shows a copy takes the copy down with it — but
 * only after asking every table that can hold an `asset_id`. `asset_usages` is
 * not the whole story: a service section and a gallery item both point straight
 * at the row, so "no placements" does not mean "used nowhere".
 */
export async function setPlacementLink(
  assetId: string,
  url: string,
): Promise<AssetUsageResult> {
  const supabase = await requireOwner()
  if (!supabase) {
    return { ok: false, error: "unauthorized" }
  }

  // Only a social copy has a post to link to; anything else has no such field.
  const purpose = await getAssetPurpose(supabase, assetId)
  if (!purpose) {
    return { ok: false, error: "That photo is no longer published." }
  }
  if (purpose !== "social") {
    return { ok: false, error: "Only a social post has a link to save." }
  }

  const saved = await setUsageLink(
    supabase,
    assetId,
    "some",
    url.trim() || null,
  )
  if (!saved.ok) {
    return { ok: false, error: "Couldn’t save the link." }
  }
  if (!saved.found) {
    // Removed elsewhere while this sheet was open. Re-creating it here would put
    // the photo back on social behind the artist's back.
    return { ok: false, error: "That photo isn’t on social any more." }
  }

  revalidatePath(routes.admin.assets)

  return { ok: true }
}

/**
 * Take a photo off one surface — and if nothing shows that copy any more, delete
 * the copy too. A published file nothing renders is still world-readable to
 * anyone who ever saw its URL, and the client is told, truthfully, where their
 * photo is shown: leaving an unreferenced public copy behind would make that
 * answer a lie.
 */
export async function removeAssetUsage(
  usageId: string,
): Promise<AssetUsageResult> {
  const supabase = await requireOwner()
  if (!supabase) {
    return { ok: false, error: "unauthorized" }
  }

  // The removed row's surface tells us whether a public page needs rebuilding.
  const removed = await removeUsage(supabase, usageId)
  if (!removed.ok) {
    return { ok: false, error: "Couldn’t remove the use-case." }
  }

  if (removed.assetId) {
    await retireAssetIfUnused(supabase, removed.assetId)
  }

  revalidatePath(routes.admin.assets)
  if (removed.surface && isPublicSurface(removed.surface)) {
    revalidatePublicSurfaces()
  }

  return { ok: true }
}
