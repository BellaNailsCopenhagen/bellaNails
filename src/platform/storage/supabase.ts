import "server-only"

import { randomUUID } from "node:crypto"

import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"

/**
 * Supabase Storage — the media backend. THREE buckets, because Supabase enforces
 * size and MIME limits per bucket and a signed upload URL can't carry a policy
 * of its own:
 *
 *   private  — the artist's originals + client-work photos.   Images + video, large.
 *   refs     — a client's design reference photos.            Images only, small.
 *   public   — published copies, world-readable.              Written by us only.
 *
 * The area is a key prefix, so a stored key alone says which bucket it is in.
 * Every call is env-guarded and returns `not_configured` rather than throwing.
 */

export type StorageResult<T> =
  { ok: true; data: T } | { ok: false; error: "not_configured" | string }

/** Where an object lives. One area per distinct upload policy. */
export type StorageArea = "private" | "refs" | "public"

const BUCKETS: Record<StorageArea, string> = {
  private: "media-private",
  refs: "media-refs",
  public: "media-public",
}

const PREFIX: Record<StorageArea, string> = {
  private: "private/",
  refs: "refs/",
  public: "public/",
}

/** How long a private-object view link stays valid. */
const VIEW_TTL_SECONDS = 300

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  return url && serviceRoleKey ? { url } : null
}

export function storageConfigured(): boolean {
  return config() !== null
}

/** The area a key belongs to, from its prefix. Unprefixed keys are private —
    fail closed, so a malformed key can never resolve to the public bucket. */
export function areaOf(key: string): StorageArea {
  if (key.startsWith(PREFIX.public)) {
    return "public"
  }
  if (key.startsWith(PREFIX.refs)) {
    return "refs"
  }

  return "private"
}

const bucketOf = (key: string) => BUCKETS[areaOf(key)]

/**
 * Canonical (unsigned) URL for any key — a stable locator. For `public/…` it is
 * directly loadable; for the private areas it resolves to a URL that refuses
 * anonymous reads, and viewing needs `signedViewUrl`.
 */
export function objectUrl(key: string): string | null {
  const cfg = config()
  if (!cfg) {
    return null
  }
  const base = cfg.url.replace(/\/$/, "")

  return `${base}/storage/v1/object/public/${bucketOf(key)}/${key}`
}

/**
 * A one-shot signed URL the browser PUTs the bytes to, plus the key to persist.
 * Size and MIME are enforced by the bucket's own `file_size_limit` /
 * `allowed_mime_types` (see docs/tasks/design-requests/PLAN.md) — the caller
 * still gates types in the route, and the browser still optimises first.
 */
export type SignedUploadTarget = { bucket: string; key: string; token: string }

export async function signedUploadUrl(input: {
  area: Exclude<StorageArea, "public">
  ext: string
}): Promise<StorageResult<SignedUploadTarget>> {
  if (!storageConfigured()) {
    return { ok: false, error: "not_configured" }
  }

  const bucket = BUCKETS[input.area]
  const key = `${PREFIX[input.area]}${randomUUID()}${input.ext}`
  try {
    const { data, error } = await createSupabaseServiceRoleClient()
      .storage.from(bucket)
      .createSignedUploadUrl(key)
    if (error || !data) {
      return { ok: false, error: message(error) }
    }

    // The browser uploads through storage-js (`uploadToSignedUrl`), so it needs
    // the bucket + token rather than the assembled URL — that keeps the request
    // shape storage-js's problem, not ours.
    return { ok: true, data: { bucket, key, token: data.token } }
  } catch (error) {
    return { ok: false, error: message(error) }
  }
}

/** Short-lived signed URL for a private object (owner / authorised client view). */
export async function signedViewUrl(
  key: string,
): Promise<StorageResult<{ url: string }>> {
  if (!storageConfigured()) {
    return { ok: false, error: "not_configured" }
  }
  try {
    const { data, error } = await createSupabaseServiceRoleClient()
      .storage.from(bucketOf(key))
      .createSignedUrl(key, VIEW_TTL_SECONDS)
    if (error || !data) {
      return { ok: false, error: message(error) }
    }

    return { ok: true, data: { url: data.signedUrl } }
  } catch (error) {
    return { ok: false, error: message(error) }
  }
}

/**
 * Copy a private object into the public bucket on consent — returns the public
 * key + URL. A FRESH key per publish: the same original published for two
 * purposes (site + social) must produce two independent objects, so withdrawing
 * one purpose can't delete the file the other still points at.
 */
export async function publishToPublic(
  privateKey: string,
): Promise<StorageResult<{ key: string; url: string }>> {
  if (!storageConfigured()) {
    return { ok: false, error: "not_configured" }
  }

  const dot = privateKey.lastIndexOf(".")
  const ext = dot >= 0 ? privateKey.slice(dot) : ""
  const publicKey = `${PREFIX.public}${randomUUID()}${ext}`
  try {
    const { error } = await createSupabaseServiceRoleClient()
      .storage.from(bucketOf(privateKey))
      .copy(privateKey, publicKey, { destinationBucket: BUCKETS.public })
    if (error) {
      return { ok: false, error: message(error) }
    }
    const url = objectUrl(publicKey)
    if (!url) {
      return { ok: false, error: "not_configured" }
    }

    return { ok: true, data: { key: publicKey, url } }
  } catch (error) {
    return { ok: false, error: message(error) }
  }
}

/**
 * Objects in one area, oldest first. Used by the reference-photo sweep to find
 * uploads that were never attached to a request — those have no row, so a
 * row-driven purge can never see them.
 */
export async function listObjects(
  area: StorageArea,
  limit = 100,
  offset = 0,
): Promise<StorageResult<{ key: string; createdAt: string }[]>> {
  if (!storageConfigured()) {
    return { ok: false, error: "not_configured" }
  }
  try {
    const { data, error } = await createSupabaseServiceRoleClient()
      .storage.from(BUCKETS[area])
      .list(PREFIX[area].replace(/\/$/, ""), {
        limit,
        offset,
        sortBy: { column: "created_at", order: "asc" },
      })
    if (error || !data) {
      return { ok: false, error: message(error) }
    }

    return {
      ok: true,
      data: data.map((object) => ({
        key: `${PREFIX[area]}${object.name}`,
        createdAt: object.created_at ?? new Date(0).toISOString(),
      })),
    }
  } catch (error) {
    return { ok: false, error: message(error) }
  }
}

/** Delete an object (private original or published copy) — the erasure primitive. */
export async function deleteObject(key: string): Promise<StorageResult<null>> {
  if (!storageConfigured()) {
    return { ok: false, error: "not_configured" }
  }
  try {
    const { error } = await createSupabaseServiceRoleClient()
      .storage.from(bucketOf(key))
      .remove([key])
    if (error) {
      return { ok: false, error: message(error) }
    }

    return { ok: true, data: null }
  } catch (error) {
    return { ok: false, error: message(error) }
  }
}

/** Delete many objects in ONE request; keys must share an area, since the bucket
    comes from the first. Callers needing per-key outcomes use `deleteObject`. */
export async function deleteObjects(
  keys: string[],
): Promise<StorageResult<null>> {
  if (!keys.length) {
    return { ok: true, data: null }
  }
  if (!storageConfigured()) {
    return { ok: false, error: "not_configured" }
  }
  try {
    const { error } = await createSupabaseServiceRoleClient()
      .storage.from(bucketOf(keys[0]))
      .remove(keys)
    if (error) {
      return { ok: false, error: message(error) }
    }

    return { ok: true, data: null }
  } catch (error) {
    return { ok: false, error: message(error) }
  }
}

function message(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message)
  }

  return error instanceof Error ? error.message : "Supabase Storage unreachable"
}
