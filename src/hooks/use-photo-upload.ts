"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"

import { uploadMedia } from "@/platform/storage/browser"
import { downscaleImage } from "@/shared/image-downscale"

/**
 * Pick → downscale → upload, with the typed failure reasons mapped to copy the
 * caller supplies. Extracted because /ask and the reply form ran the identical
 * procedure, so a new `UploadResult.reason` had to be handled twice — and
 * `"unsupported"` already was not, in either copy.
 *
 * Returns the storage key to persist, or null when nothing was stored (the
 * reason has already been surfaced to the user).
 */
export type PhotoUploadLabels = {
  /** Browser couldn't decode/resize the file. */
  processFailed: string
  /** Storage isn't configured — informational, not an error. */
  notConfigured: string
  /** Too many uploads too quickly. */
  rateLimited: string
  /** Wrong file type for this caller's policy. */
  unsupported: string
  /** Anything else. */
  failed: string
}

export function usePhotoUpload(labels: PhotoUploadLabels) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const pick = () => inputRef.current?.click()

  const take = async (files: FileList | null): Promise<string | null> => {
    const file = files?.[0]
    if (!file) return null
    setUploading(true)
    try {
      let blob: Blob
      try {
        blob = await downscaleImage(file)
      } catch {
        toast.error(labels.processFailed)
        return null
      }

      const up = await uploadMedia(blob, "image/webp")
      if (up.ok) return up.key

      // Nothing was stored, so never say the message failed to send.
      if (up.reason === "not_configured") toast.info(labels.notConfigured)
      else if (up.reason === "rate_limited") toast.error(labels.rateLimited)
      else if (up.reason === "unsupported") toast.error(labels.unsupported)
      else toast.error(labels.failed)
      return null
    } finally {
      setUploading(false)
      // Let the same file be re-picked after a failure.
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return { inputRef, uploading, pick, take }
}
