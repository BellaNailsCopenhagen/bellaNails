"use client"

import { createSupabaseSessionBrowserClient } from "@/platform/supabase/ssr-browser"
import { optimizeImage } from "@/shared/image-optimize"
import { optimizeVideo, VideoTooLongError } from "@/shared/video-optimize"
import {
  IMAGE_TYPES,
  VIDEO_TYPES,
  type ImagePolicy,
  type VideoPolicy,
} from "@/shared/media-policy"

/**
 * Browser upload, shared by every uploader. Our route mints a one-shot signed
 * URL, so the browser never holds a storage credential and the server still
 * picks the bucket. Images are put through the image policy on the way; the
 * caller only does the DB insert.
 *
 * A FILM is only re-encoded when the caller asks for it, which is the one place
 * this is opt-in — re-encoding drops the audio (a canvas stream has none), and
 * that is right for a muted background and wrong for a clip someone might want
 * to hear. So the hero opts in and a booking's demo clip does not.
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
        | "too_long"
        | "too_large"
        | "failed"
    }

import type { SignedUploadTarget } from "@/platform/storage/supabase"

export async function uploadMedia(
  file: Blob,
  contentType: string,
  opts: {
    /** Re-encode a film to this policy. Omit to store it untouched — see above. */
    video?: VideoPolicy
    /** 0..1 through the re-encode, which runs in real time. */
    onProgress?: (fraction: number) => void
  } = {},
): Promise<UploadResult> {
  // An image is ALWAYS stored as webp, so that is what we ask to sign — the key
  // extension comes from the type we send. Anything that isn't a known image
  // goes up as-is, which is what lets the server answer `unsupported` for a
  // type the caller's tier doesn't allow.
  const isImage = IMAGE_TYPES.includes(contentType)
  let storedType = isImage ? "image/webp" : contentType
  let blob = file

  // A film is re-encoded BEFORE signing, unlike an image: `MediaRecorder` picks
  // the container at runtime and the stored key's extension comes from the type
  // we sign with, so the bytes have to exist first. It also means a browser that
  // cannot encode costs no upload token to find out.
  if (opts.video && VIDEO_TYPES.includes(contentType)) {
    try {
      const encoded = await optimizeVideo(file, opts.video, opts.onProgress)
      blob = encoded.blob
      storedType = encoded.type
    } catch (error) {
      if (error instanceof VideoTooLongError) {
        return { ok: false, reason: "too_long" }
      }
      // Anything else — no encoder here, a decoder that gave up — falls through
      // with the original, which the size check below then has to catch.
      console.error("[media] couldn't re-encode the film:", error)
    }

    // On the blob that is ACTUALLY going up, whichever produced it. The encoder
    // treats the bitrate as a hint, and a film it could not re-encode arrives
    // here at its camera size — so without this a 40 MB clip reached the public
    // bucket whenever the re-encode failed, which is the one thing the cap
    // exists to prevent.
    if (blob.size > opts.video.maxBytes) {
      return { ok: false, reason: "too_large" }
    }
  }

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

  // The image policy is applied HERE, not by each uploader. Three of the four
  // call sites had skipped it and were shipping camera originals — a 6240x4160,
  // 2 MB JPEG — straight to the public bucket.
  if (isImage) {
    try {
      blob = await optimizeImage(file, image)
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
