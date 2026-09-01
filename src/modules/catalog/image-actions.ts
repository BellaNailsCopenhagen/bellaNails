"use server"

import { insertAsset } from "@/db/assets"
import { requireOwner } from "@/modules/identity/require-owner"
import { publishToPublic } from "@/platform/storage/supabase"

/**
 * Publishing a freshly-uploaded studio image (a private storage key from
 * uploadMedia) into the public bucket, in the two shapes the catalog needs.
 * Both return the picker's value shape so either can back an ImagePicker.
 */

export type PublishedImage =
  | { ok: true; assetId: string | null; url: string }
  | { ok: false; error: string }

async function publish(
  storageKey: string,
): Promise<{ ok: true; url: string; key: string } | { ok: false; error: string }> {
  if (!storageKey) return { ok: false, error: "No file uploaded." }
  const published = await publishToPublic(storageKey)
  if (!published.ok) {
    return {
      ok: false,
      error:
        published.error === "not_configured"
          ? "Storage isn’t set up yet."
          : "Couldn’t publish the image.",
    }
  }
  return { ok: true, url: published.data.url, key: published.data.key }
}

/** Publish and record an `assets` row — for a surface that stores `asset_id`
    and so keeps the media system able to find, place and erase the image. */
export async function publishStudioAsset(
  storageKey: string,
): Promise<PublishedImage> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "unauthorized" }

  const published = await publish(storageKey)
  if (!published.ok) return published

  const asset = await insertAsset(db, {
    url: published.url,
    media_type: "image",
    storage_key: published.key,
  })
  if (!asset.ok) return { ok: false, error: "Couldn’t save the image." }
  return { ok: true, assetId: asset.id, url: published.url }
}

/** Publish and return the URL only — for a surface that stores a bare URL.
    Deliberately writes no `assets` row: nothing would ever reference it, and an
    asset the media hub can neither list nor erase is worse than none. */
export async function publishStudioImageUrl(
  storageKey: string,
): Promise<PublishedImage> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "unauthorized" }

  const published = await publish(storageKey)
  if (!published.ok) return published
  return { ok: true, assetId: null, url: published.url }
}
