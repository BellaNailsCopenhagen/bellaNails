"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"

import { uploadMedia } from "@/platform/storage/browser"
import type { VideoPolicy } from "@/shared/media-policy"

/**
 * Pick → upload, with the typed failure reasons mapped to copy the caller
 * supplies. Extracted because /ask and the reply form ran the identical
 * procedure, so a new `UploadResult.reason` had to be handled twice — and
 * `"unsupported"` already was not, in either copy. Optimising itself now lives
 * in `uploadMedia`, where no uploader can skip it.
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
  /** Film longer than the re-encode allows. Optional because only a caller that
      passes a video policy can ever see it — the image-only ones would be
      writing copy for a branch they cannot reach. */
  tooLong?: string
  /** Film still over the byte cap after the re-encode, or one that could not be
      re-encoded at all. Optional for the same reason. */
  tooLarge?: string
  /** Anything else. */
  failed: string
}

export function usePhotoUpload(
  labels: PhotoUploadLabels,
  /** Pass a policy to re-encode films too. Omit and they upload untouched — see
      `uploadMedia`, where the reason it is opt-in lives. */
  video?: VideoPolicy,
) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  // Null unless a film is being re-encoded, which happens in real time and so
  // needs a number rather than a spinner that looks stuck.
  const [progress, setProgress] = useState<number | null>(null)

  const pick = () => inputRef.current?.click()

  const take = async (files: FileList | null): Promise<string | null> => {
    const file = files?.[0]
    if (!file) {
      return null
    }
    setUploading(true)
    try {
      // `uploadMedia` optimises — passing the file's own type lets the server
      // reject one the policy doesn't allow.
      const up = await uploadMedia(file, file.type, {
        video,
        onProgress: setProgress,
      })
      if (up.ok) {
        return up.key
      }

      // Nothing was stored, so never say the message failed to send.
      if (up.reason === "not_configured") {
        toast.info(labels.notConfigured)
      } else if (up.reason === "rate_limited") {
        toast.error(labels.rateLimited)
      } else if (up.reason === "unsupported") {
        toast.error(labels.unsupported)
      } else if (up.reason === "process_failed") {
        toast.error(labels.processFailed)
      } else if (up.reason === "too_long") {
        toast.error(labels.tooLong ?? labels.failed)
      } else if (up.reason === "too_large") {
        toast.error(labels.tooLarge ?? labels.failed)
      } else {
        toast.error(labels.failed)
      }

      return null
    } finally {
      setUploading(false)
      setProgress(null)
      // Let the same file be re-picked after a failure.
      if (inputRef.current) {
        inputRef.current.value = ""
      }
    }
  }

  return { inputRef, uploading, progress, pick, take }
}
