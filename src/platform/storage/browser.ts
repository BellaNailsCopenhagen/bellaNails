"use client"

import { createSupabaseSessionBrowserClient } from "@/platform/supabase/ssr-browser"
import { downscaleImage } from "@/shared/image-downscale"
import { IMAGE_TYPES, type ImagePolicy } from "@/shared/media-policy"

/**
 * Browser upload, shared by every uploader. Our route mints a one-shot signed
 * URL, so the browser never holds a storage credential and the server still
 * picks the bucket. Images are put through the image policy on the way; the
 * caller only does the DB insert.
 */
export type UploadResult =
  | { ok: true; key: string }
  | {
      ok: false
      reason:
        | "not_configured"
        | "unsupported"
        | "rate_limited"
        | "process_failed"
        | "failed"
    }

import type { SignedUploadTarget } from "@/platform/storage/supabase"

export async function uploadMedia(
  file: Blob,
  contentType: string,
): Promise<UploadResult> {
  // An image is ALWAYS stored as webp, so that is what we ask to sign — the key
  // extension comes from the type we send. Anything that isn't a known image
  // goes up as-is, which is what lets the server answer `unsupported` for a
  // type the caller's tier doesn't allow.
  const isImage = IMAGE_TYPES.includes(contentType)
  const storedType = isImage ? "image/webp" : contentType

  const signRes = await fetch("/api/media/sign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contentType: storedType }),
  }).catch(() => null)

  if (!signRes) return { ok: false, reason: "failed" }
  if (signRes.status === 503) return { ok: false, reason: "not_configured" }
  if (signRes.status === 400) return { ok: false, reason: "unsupported" }
  if (signRes.status === 429) return { ok: false, reason: "rate_limited" }
  if (!signRes.ok) return { ok: false, reason: "failed" }

  const { bucket, key, token, image } = (await signRes.json()) as SignedUploadTarget & {
    image: ImagePolicy
  }

  // The policy is applied HERE, not by each uploader. Three of the four call
  // sites had skipped it and were shipping camera originals — a 6240x4160, 2 MB
  // JPEG — straight to the public bucket. Video passes through untouched: it is
  // the one thing a canvas can't re-encode.
  let blob = file
  if (isImage) {
    try {
      blob = await downscaleImage(file, image)
    } catch {
      return { ok: false, reason: "process_failed" }
    }
  }

  const { error } = await createSupabaseSessionBrowserClient()
    .storage.from(bucket)
    .uploadToSignedUrl(key, token, blob, { contentType: storedType })

  // A bucket size/MIME limit rejects here — the server-enforced backstop behind
  // the client-side gate, so a hand-built request can't slip a 200 MB file in.
  if (error) return { ok: false, reason: "failed" }
  return { ok: true, key }
}
