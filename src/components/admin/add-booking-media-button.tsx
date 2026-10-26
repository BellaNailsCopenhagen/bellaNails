"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ImagePlus } from "lucide-react"
import { toast } from "sonner"

import { cardActionNeutral } from "@/components/admin/card-action"
import { addClientMedia } from "@/modules/media/owner-media-actions"
import { uploadMedia } from "@/platform/storage/browser"
import { kindForType } from "@/shared/media-policy"

/**
 * Owner "Add media" on a booking card — uploads an image or demo video attached
 * to this booking + client (owner source; the action inherits the service). The
 * card gates visibility (from 30 min before start onward).
 */
export function AddBookingMediaButton({
  bookingId,
  clientId,
}: {
  bookingId: string
  clientId: string
}) {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const onFile = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) {
      return
    }
    setUploading(true)
    try {
      const up = await uploadMedia(file, file.type)
      if (!up.ok) {
        toast.error(
          up.reason === "not_configured"
            ? "Storage isn’t set up yet."
            : up.reason === "unsupported"
              ? "That file type isn’t allowed."
              : up.reason === "process_failed"
                ? "That image couldn’t be read."
                : "Upload failed.",
        )

        return
      }
      const result = await addClientMedia({
        clientId,
        storageKey: up.key,
        kind: kindForType(file.type),
        bookingId,
      })
      if (result.ok) {
        toast.success("Media added")
        router.refresh()
      } else {
        toast.error(result.error || "Couldn’t add.")
      }
    } finally {
      setUploading(false)
      if (inputRef.current) {
        inputRef.current.value = ""
      }
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
        hidden
        onChange={(e) => onFile(e.target.files)}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className={cardActionNeutral("gap-1 text-[0.625rem]")}
      >
        <ImagePlus className="size-3" />
        {uploading ? "Adding…" : "Add media"}
      </button>
    </>
  )
}
