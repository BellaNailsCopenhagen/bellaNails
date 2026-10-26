"use server"

import { insertAsset } from "@/db/assets"
import { requireOwner } from "@/modules/identity/require-owner"
import { deleteObject, publishToPublic } from "@/platform/storage/supabase"

/**
 * Publishing a freshly-uploaded studio image (a private storage key from
 * uploadMedia) into the public bucket, in the two shapes the catalog needs.
 * Both return the picker's value shape so either can back an ImagePicker.
 *
 * The private upload is STAGING, and is deleted once the public copy is safely
 * recorded. An owner's upload always lands in the private bucket — that is the
 * signed-upload route's rule, not a choice made here — and for a studio image
 * nothing ever reads it again: the row that gets written points at the public
 * key. Left behind it is unreachable, so taking the image down later deletes the
 * public copy and the row while the original sits in the bucket forever. That is
 * not a tidiness problem: the artist is told the file is deleted.
 *
 * A client's photo is the opposite case and must keep its original — that one is
 * her library copy, and `client_media.storage_key` still points at it.
 */

export type PublishedImage =
  | { ok: true; assetId: string | null; url: string }
  | { ok: false; error: string }

async function publish(
  storageKey: string,
): Promise<
  { ok: true; url: string; key: string } | { ok: false; error: string }
> {
  if (!storageKey) {
    return { ok: false, error: "No file uploaded." }
  }
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
  if (!db) {
    return { ok: false, error: "unauthorized" }
  }

  const published = await publish(storageKey)
  if (!published.ok) {
    return published
  }

  const asset = await insertAsset(db, {
    url: published.url,
    media_type: "image",
    storage_key: published.key,
  })
  if (!asset.ok) {
    // Nothing points at the copy now, and it is world-readable — take it back
    // out and keep the staging file so she can retry.
    await deleteObject(published.key)

    return { ok: false, error: "Couldn’t save the image." }
  }

  await discardStaging(storageKey)

  return { ok: true, assetId: asset.id, url: published.url }
}

/** Publish and return the URL only — for a surface that stores a bare URL.
    Deliberately writes no `assets` row: nothing would ever reference it, and an
    asset the media hub can neither list nor erase is worse than none. */
export async function publishStudioImageUrl(
  storageKey: string,
): Promise<PublishedImage> {
  const db = await requireOwner()
  if (!db) {
    return { ok: false, error: "unauthorized" }
  }

  const published = await publish(storageKey)
  if (!published.ok) {
    return published
  }

  await discardStaging(storageKey)

  return { ok: true, assetId: null, url: published.url }
}

/** The published copy is the artifact; the upload it was copied from is not.
    A failure here only leaves a file — the image is published either way — so it
    is logged rather than surfaced. */
async function discardStaging(storageKey: string): Promise<void> {
  const gone = await deleteObject(storageKey)
  if (!gone.ok) {
    console.error(`[asset] staging upload ${storageKey} kept:`, gone.error)
  }
}
