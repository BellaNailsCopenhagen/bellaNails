import { IMAGE_MAX_DIM } from "@/shared/media-policy"

/**
 * Client-side prep for a client upload: downscale (longest side ≤ maxDim) and
 * re-encode to webp, **preserving the original aspect ratio** — we never crop a
 * client's photo. The re-encode strips EXIF/GPS (GDPR data-minimisation) so raw
 * metadata never leaves the device; `imageOrientation: "from-image"` bakes the
 * EXIF rotation in first, so portraits don't land sideways. Browser-only
 * (canvas) — call from a client component.
 */
export async function downscaleImage(
  file: File,
  maxDim: number = IMAGE_MAX_DIM,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  const { width, height } = bitmap

  // Fit within maxDim on the longest side; keep aspect ratio. Never upscale.
  const scale = Math.min(1, maxDim / Math.max(width, height))
  const dw = Math.round(width * scale)
  const dh = Math.round(height * scale)

  const canvas = document.createElement("canvas")
  canvas.width = dw
  canvas.height = dh
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas unsupported")
  ctx.drawImage(bitmap, 0, 0, dw, dh)
  bitmap.close()

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Encode failed"))),
      "image/webp",
      0.85,
    ),
  )
}
