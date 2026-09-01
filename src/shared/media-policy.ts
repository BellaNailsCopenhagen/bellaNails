/**
 * Upload policy shared by the presign route (server, enforces it) and the
 * uploaders (client, gates the UI). Two tiers (decision 9): clients upload
 * optimised images only; the owner may also upload a demo video, larger.
 */

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]
export const VIDEO_TYPES = ["video/mp4", "video/webm"]

export const CLIENT_MAX_BYTES = 5 * 1024 * 1024 // post-optimisation an image is tiny
export const OWNER_MAX_BYTES = 200 * 1024 * 1024 // room for a short demo clip

/**
 * The image policy, in one place (decision 31 Aug 2026): every upload is
 * downscaled to `IMAGE_MAX_DIM` on its longest side and re-encoded to WebP at
 * `IMAGE_QUALITY`. Measured output at these settings is ~46 KB for a wide photo
 * and ~87 KB for a close-up, so ~62 KB blended — roughly 17,000 images in the
 * 1 GB free tier. Storage is not the constraint; egress is.
 *
 * Aspect ratio is always preserved: we never crop an upload. A client's
 * reference photo is often a screenshot, where a centre crop can cut the design
 * out of frame. Fixed ratios belong to OUR display surfaces, in CSS.
 */
export const IMAGE_MAX_DIM = 1200
export const IMAGE_QUALITY = 0.82

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
