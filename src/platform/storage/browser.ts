"use client"

import { createSupabaseSessionBrowserClient } from "@/platform/supabase/ssr-browser"

/**
 * Browser upload, shared by every uploader (the artist's gallery/booking media,
 * a client's design references). Our route mints a one-shot signed upload URL —
 * so the browser never holds a storage credential and the server still decides
 * which bucket the caller may write to — then storage-js PUTs the bytes
 * straight there. Returns the object key to persist, or a typed reason so the
 * caller shows the right message.
 *
 * The caller does any pre-processing (`downscaleImage`) and the DB insert.
 */
export type UploadResult =
  | { ok: true; key: string }
  | {
      ok: false
      reason: "not_configured" | "unsupported" | "rate_limited" | "failed"
    }

import type { SignedUploadTarget } from "@/platform/storage/supabase"

export async function uploadMedia(
  file: Blob,
  contentType: string,
): Promise<UploadResult> {
  const signRes = await fetch("/api/media/sign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contentType }),
  }).catch(() => null)

  if (!signRes) return { ok: false, reason: "failed" }
  if (signRes.status === 503) return { ok: false, reason: "not_configured" }
  if (signRes.status === 400) return { ok: false, reason: "unsupported" }
  if (signRes.status === 429) return { ok: false, reason: "rate_limited" }
  if (!signRes.ok) return { ok: false, reason: "failed" }

  const { bucket, key, token } = (await signRes.json()) as SignedUploadTarget

  const { error } = await createSupabaseSessionBrowserClient()
    .storage.from(bucket)
    .uploadToSignedUrl(key, token, file, { contentType })

  // A bucket size/MIME limit rejects here — the server-enforced backstop behind
  // the client-side gate, so a hand-built request can't slip a 200 MB file in.
  if (error) return { ok: false, reason: "failed" }
  return { ok: true, key }
}
