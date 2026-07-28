"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { BodySm } from "@/components/ui/typography"
import { DeleteOwnMediaButton } from "@/components/sections/delete-own-media-button"
import { downscaleImage } from "@/lib/client/process-image"
import { uploadMedia } from "@/lib/client/upload-media"
import { addOwnBookingMedia } from "@/lib/actions/client-media"
import type { ClientMediaItem } from "@/lib/media"

// English copy (this widget isn't localized yet — matches its other strings).
const DELETE_LABELS = {
  title: "Remove this photo?",
  body: "This permanently deletes it from Bella Nails — including any copy shared to the website or social. This can’t be undone.",
  confirm: "Remove",
  confirming: "Removing…",
  cancel: "Keep it",
  failed: "Couldn’t remove the photo.",
}

/**
 * The client adds a photo to their own past booking, from /bookings. One image
 * at a time: it's cropped + downscaled + EXIF-stripped in the browser, then
 * uploaded straight to a private Scaleway object via a presigned POST. Without
 * keys the signing endpoint returns 503 and we say so. Photos are shared with
 * the artist for the appointment — publishing them needs the separate consent.
 */
export function BookingPhotos({
  bookingId,
  photos,
}: {
  bookingId: string
  photos: ClientMediaItem[]
}) {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const onFile = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setUploading(true)
    try {
      let blob: Blob
      try {
        blob = await downscaleImage(file)
      } catch {
        toast.error("Couldn’t process that image.")
        return
      }

      const up = await uploadMedia(blob, "image/webp")
      if (!up.ok) {
        if (up.reason === "not_configured") {
          toast.info("Photo upload isn’t set up yet — check back soon.")
        } else {
          toast.error("An image failed to upload.")
        }
        return
      }

      const result = await addOwnBookingMedia({ bookingId, storageKey: up.key })
      if (result.ok) {
        toast.success("Photo added")
        router.refresh()
      } else {
        toast.error("Couldn’t save the photo.")
      }
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-3">
      {photos.length ? (
        <ul className="flex flex-wrap gap-2">
          {photos.map((photo) => (
            <li key={photo.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt="Your photo"
                className="size-16 rounded-sm border border-border object-cover"
              />
              {photo.source === "client" ? (
                <DeleteOwnMediaButton
                  mediaId={photo.id}
                  labels={DELETE_LABELS}
                  trigger={
                    <button
                      type="button"
                      aria-label="Remove photo"
                      className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border border-border bg-background text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      ×
                    </button>
                  }
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => onFile(e.target.files)}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading
            ? "Uploading…"
            : photos.length
              ? "Add another"
              : "Share your set"}
        </Button>
      </div>

      <BodySm className="text-xs text-muted-foreground">
        {photos.length ? (
          <>
            Thank you for sharing — it means the world to us. Your photos stay
            private to the studio and are never published without your
            permission; you can remove them any time.
          </>
        ) : (
          <>
            Loved your set? Share a photo with Bella Nails. Your photos stay
            private to the studio and are never published without your
            permission — you can remove them any time.
          </>
        )}
      </BodySm>
    </div>
  )
}
