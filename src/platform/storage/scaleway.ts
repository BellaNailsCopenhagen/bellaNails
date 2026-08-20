import "server-only"

import { randomUUID } from "node:crypto"
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { createPresignedPost } from "@aws-sdk/s3-presigned-post"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

/**
 * Scaleway Object Storage (EU-sovereign, S3-compatible) — the media backend.
 * Private-by-default: everything lands under `private/`; consented copies move to
 * `public/` (world-readable via the bucket policy). Every call is env-guarded and
 * returns `not_configured` when keys are absent, so the app boots and the flow
 * degrades gracefully until Scaleway is set up.
 */

export type StorageResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: "not_configured" | string }

const PRIVATE_PREFIX = "private/"
const PUBLIC_PREFIX = "public/"

function config() {
  const accessKeyId = process.env.SCALEWAY_ACCESS_KEY
  const secretAccessKey = process.env.SCALEWAY_SECRET_KEY
  const region = process.env.SCALEWAY_REGION
  const endpoint = process.env.SCALEWAY_ENDPOINT
  const bucket = process.env.SCALEWAY_BUCKET
  const publicBaseUrl = process.env.NEXT_PUBLIC_SCALEWAY_PUBLIC_BASE_URL
  if (
    !accessKeyId ||
    !secretAccessKey ||
    !region ||
    !endpoint ||
    !bucket ||
    !publicBaseUrl
  ) {
    return null
  }
  return { accessKeyId, secretAccessKey, region, endpoint, bucket, publicBaseUrl }
}

export function storageConfigured(): boolean {
  return config() !== null
}

// One client per config — virtual-hosted style (Scaleway default), not path-style.
let cached: { client: S3Client; key: string } | null = null
function client(cfg: NonNullable<ReturnType<typeof config>>): S3Client {
  const key = `${cfg.endpoint}:${cfg.accessKeyId}`
  if (cached?.key !== key) {
    cached = {
      key,
      client: new S3Client({
        region: cfg.region,
        endpoint: cfg.endpoint,
        credentials: {
          accessKeyId: cfg.accessKeyId,
          secretAccessKey: cfg.secretAccessKey,
        },
      }),
    }
  }
  return cached.client
}

/** The public URL of a `public/…` object. */
function publicUrl(cfg: NonNullable<ReturnType<typeof config>>, key: string) {
  return `${cfg.publicBaseUrl.replace(/\/$/, "")}/${key}`
}

/** Canonical (unsigned) URL for any key — a stable locator. For `public/…` it's
    directly loadable; for `private/…` it 403s and needs `presignedGet`. */
export function objectUrl(key: string): string | null {
  const cfg = config()
  return cfg ? publicUrl(cfg, key) : null
}

/**
 * Presigned POST for a browser upload into `private/`. Size + content-type are
 * server-enforced by the policy (decision 7 + 9) — the caller passes the role's
 * `maxBytes` and the exact `contentType`. Returns the form target + fields and
 * the object key to persist.
 */
export async function presignedUpload(input: {
  contentType: string
  maxBytes: number
  ext: string
}): Promise<StorageResult<{ url: string; key: string; fields: Record<string, string> }>> {
  const cfg = config()
  if (!cfg) return { ok: false, error: "not_configured" }

  const key = `${PRIVATE_PREFIX}${randomUUID()}${input.ext}`
  try {
    const { url, fields } = await createPresignedPost(client(cfg), {
      Bucket: cfg.bucket,
      Key: key,
      Conditions: [
        ["content-length-range", 1, input.maxBytes],
        ["eq", "$Content-Type", input.contentType],
      ],
      Fields: { "Content-Type": input.contentType },
      Expires: 60,
    })
    return { ok: true, data: { url, key, fields } }
  } catch (error) {
    return { ok: false, error: message(error) }
  }
}

/** Short-lived presigned GET for a private object (owner/authorised client view). */
export async function presignedGet(
  key: string,
): Promise<StorageResult<{ url: string }>> {
  const cfg = config()
  if (!cfg) return { ok: false, error: "not_configured" }
  try {
    const url = await getSignedUrl(
      client(cfg),
      new GetObjectCommand({ Bucket: cfg.bucket, Key: key }),
      { expiresIn: 300 },
    )
    return { ok: true, data: { url } }
  } catch (error) {
    return { ok: false, error: message(error) }
  }
}

/** Copy a `private/` object to `public/` on consent — returns the public key + URL.
    The copy gets a `public-read` ACL so anonymous GET works; the bucket itself
    stays private (a bucket policy would lock the owner out — see the migration doc). */
export async function publishToPublic(
  privateKey: string,
): Promise<StorageResult<{ key: string; url: string }>> {
  const cfg = config()
  if (!cfg) return { ok: false, error: "not_configured" }

  // A fresh key per publish — the same private image published for two purposes
  // (site + social) must produce two independent public objects, so withdrawing
  // one purpose can't delete the file the other still points at.
  const dot = privateKey.lastIndexOf(".")
  const ext = dot >= 0 ? privateKey.slice(dot) : ""
  const publicKey = `${PUBLIC_PREFIX}${randomUUID()}${ext}`
  try {
    await client(cfg).send(
      new CopyObjectCommand({
        Bucket: cfg.bucket,
        CopySource: `${cfg.bucket}/${privateKey}`,
        Key: publicKey,
        ACL: "public-read",
      }),
    )
    return { ok: true, data: { key: publicKey, url: publicUrl(cfg, publicKey) } }
  } catch (error) {
    return { ok: false, error: message(error) }
  }
}

/** Delete an object (private original or published copy) — the erasure primitive. */
export async function deleteObject(key: string): Promise<StorageResult<null>> {
  const cfg = config()
  if (!cfg) return { ok: false, error: "not_configured" }
  try {
    await client(cfg).send(
      new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }),
    )
    return { ok: true, data: null }
  } catch (error) {
    return { ok: false, error: message(error) }
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Scaleway unreachable"
}
