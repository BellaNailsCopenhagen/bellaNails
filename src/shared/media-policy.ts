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
 * The image policy, in two tiers. Every upload is downscaled to `maxDim` on its
 * longest side and re-encoded to WebP at `quality`; the re-encode also strips
 * EXIF, so a photo's GPS never reaches a public object.
 *
 * A client's upload is working material — a reference photo, often a screenshot
 * of someone else's set — and 1200px is plenty to work from. The studio's own
 * photos ARE the product: they get shown full-screen in the gallery lightbox, so
 * they keep more pixels.
 *
 * Measured on the studio's own 6240x4160 originals (6 Sep 2026). At 1900px
 * q0.75: a wide shot 68 KB, a close-up 102 KB, a phone-sharpened close-up
 * 154 KB — so ~150 KB is the ceiling, ~100 KB the blend, about 10,000 images in
 * the 1 GB free tier. Storage is not the constraint; egress is.
 *
 * The portfolio tier trades quality for resolution because resolution wins:
 * against the original at a 1300px view (a lightbox on a 2x laptop), 1900px
 * q0.75 scores 40.6 dB where 1200px q0.82 scores 35.3 — a visibly better photo
 * for 28 KB more. Past q0.78 the curve flattens: another 35 KB buys 1.4 dB.
 * The client tier keeps q0.82 because at 1200px there is no extra resolution to
 * pay for it with.
 *
 * Aspect ratio is always preserved: we never crop an upload. A client's
 * reference photo is often a screenshot, where a centre crop can cut the design
 * out of frame. Fixed ratios belong to OUR display surfaces, in CSS.
 */
export type ImagePolicy = { maxDim: number; quality: number }

export const CLIENT_IMAGE: ImagePolicy = { maxDim: 1200, quality: 0.82 }
export const PORTFOLIO_IMAGE: ImagePolicy = { maxDim: 1900, quality: 0.75 }

/** Which tier a caller gets. Decided server-side, from the same `isOwner` the
    bucket is chosen by — the browser must not be able to ask for the bigger one. */
export function imagePolicy(owner: boolean): ImagePolicy {
  return owner ? PORTFOLIO_IMAGE : CLIENT_IMAGE
}

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

/**
 * Photo or film, read from a stored key's extension.
 *
 * The extension is written by the presign route from the content type, so it
 * describes the bytes rather than guessing at them — which is why a surface that
 * accepts either can store ONE key and no separate "kind" to keep in step.
 * Anything unrecognised reads as an image: that renders an `<img>`, which fails
 * as a broken picture rather than as a silent black rectangle.
 */
export function kindForKey(key: string): "image" | "video" {
  const dot = key.lastIndexOf(".")
  const ext = dot >= 0 ? key.slice(dot).toLowerCase() : ""
  return VIDEO_TYPES.some((type) => EXT[type] === ext) ? "video" : "image"
}

/**
 * The cap on a hero film, and the one number in the app worth arguing about.
 *
 * A background video is served to EVERY visitor of the landing page, so it is
 * the largest recurring cost the site has: a film at this cap is about 640 page
 * loads against a 5 GB monthly egress allowance. Ten seconds of 1080p at a sane
 * bitrate lands near 4 MB, so this leaves room without leaving room for a
 * phone's untouched 45-second clip.
 */
export const HERO_VIDEO_MAX_BYTES = 8 * 1024 * 1024
