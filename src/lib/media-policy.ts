/**
 * Upload policy shared by the presign route (server, enforces it) and the
 * uploaders (client, gates the UI). Two tiers (decision 9): clients upload
 * optimised images only; the owner may also upload a demo video, larger.
 */

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]
export const VIDEO_TYPES = ["video/mp4", "video/webm"]

export const CLIENT_MAX_BYTES = 5 * 1024 * 1024 // post-optimisation an image is tiny
export const OWNER_MAX_BYTES = 200 * 1024 * 1024 // room for a short demo clip

/** Longest-side cap for client image downscale (aspect ratio preserved — we
    never crop a client's photo). */
export const IMAGE_MAX_DIM = 2000

export function uploadPolicy(owner: boolean): {
  allowedTypes: string[]
  maxBytes: number
} {
  return owner
    ? { allowedTypes: [...IMAGE_TYPES, ...VIDEO_TYPES], maxBytes: OWNER_MAX_BYTES }
    : { allowedTypes: IMAGE_TYPES, maxBytes: CLIENT_MAX_BYTES }
}

const EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
}

export function extForType(contentType: string): string {
  return EXT[contentType] ?? ""
}

export function kindForType(contentType: string): "image" | "video" {
  return contentType.startsWith("video/") ? "video" : "image"
}
