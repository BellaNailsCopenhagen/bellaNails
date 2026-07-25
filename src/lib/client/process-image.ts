import { GALLERY_RATIO, IMAGE_MAX_DIM } from "@/lib/media-policy"

/**
 * Client-side prep for a client upload: center-crop to the gallery ratio,
 * downscale, and re-encode to webp. The re-encode strips EXIF/GPS (GDPR
 * data-minimisation) so raw metadata never leaves the device; `imageOrientation:
 * "from-image"` bakes the EXIF rotation in first, so portraits don't land
 * sideways. Browser-only (canvas) — call from a client component.
 */
export async function cropAndDownscale(
  file: File,
  ratio: number = GALLERY_RATIO,
  maxDim: number = IMAGE_MAX_DIM,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  const { width, height } = bitmap

  // Center-crop to width/height = ratio.
  let cropW = width
  let cropH = Math.round(width / ratio)
  if (cropH > height) {
    cropH = height
    cropW = Math.round(height * ratio)
  }
  const sx = Math.round((width - cropW) / 2)
  const sy = Math.round((height - cropH) / 2)

  // Downscale so the longest side ≤ maxDim.
  let dw = cropW
  let dh = cropH
  const longest = Math.max(dw, dh)
  if (longest > maxDim) {
    const scale = maxDim / longest
    dw = Math.round(dw * scale)
    dh = Math.round(dh * scale)
  }

  const canvas = document.createElement("canvas")
  canvas.width = dw
  canvas.height = dh
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas unsupported")
  ctx.drawImage(bitmap, sx, sy, cropW, cropH, 0, 0, dw, dh)
  bitmap.close()

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Encode failed"))),
      "image/webp",
      0.85,
    ),
  )
}
