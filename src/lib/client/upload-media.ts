/**
 * Browser upload to storage, shared by every uploader (client photos, owner
 * card + gallery): ask our route for a presigned POST, then upload the bytes
 * straight to the bucket. Returns the object key to persist, or a typed reason
 * so the caller can show the right message. Caller does any pre-processing
 * (e.g. client-image downscale) and the DB insert.
 */
export type UploadResult =
  | { ok: true; key: string }
  | { ok: false; reason: "not_configured" | "unsupported" | "failed" }

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
  if (!signRes.ok) return { ok: false, reason: "failed" }

  const { url, key, fields } = (await signRes.json()) as {
    url: string
    key: string
    fields: Record<string, string>
  }

  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) form.set(k, v)
  form.set("file", file)
  const up = await fetch(url, { method: "POST", body: form }).catch(() => null)
  if (!up || !up.ok) return { ok: false, reason: "failed" }

  return { ok: true, key }
}
