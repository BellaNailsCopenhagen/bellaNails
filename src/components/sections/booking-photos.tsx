"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { BodySm } from "@/components/ui/typography"
import { DeleteOwnMediaButton } from "@/components/sections/delete-own-media-button"
import { downscaleImage } from "@/shared/image-downscale"
import { uploadMedia } from "@/shared/upload-media"
import { addOwnBookingMedia } from "@/modules/media/client-media-actions"
import type { ClientMediaItem } from "@/modules/media/client-gallery"

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
  const t = useTranslations("bookings")
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const deleteLabels = {
    title: t("deleteTitle"),
    body: t("deleteBody"),
    confirm: t("deleteConfirm"),
    confirming: t("deleteConfirming"),
    cancel: t("deleteCancel"),
    failed: t("loadError"),
  }

  const onFile = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setUploading(true)
    try {
      let blob: Blob
      try {
        blob = await downscaleImage(file)
      } catch {
        toast.error(t("photoProcessFailed"))
        return
      }

      const up = await uploadMedia(blob, "image/webp")
      if (!up.ok) {
        if (up.reason === "not_configured") {
          toast.info(t("photoUploadNotConfigured"))
        } else {
          toast.error(t("photoUploadFailed"))
        }
        return
      }

      const result = await addOwnBookingMedia({ bookingId, storageKey: up.key })
      if (result.ok) {
        toast.success(t("photoAdded"))
        router.refresh()
      } else {
        toast.error(t("photoSaveFailed"))
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
                alt={t("photoAlt")}
                className="size-16 rounded-sm border border-border object-cover"
              />
              {photo.source === "client" ? (
                <DeleteOwnMediaButton
                  mediaId={photo.id}
                  labels={deleteLabels}
                  trigger={
                    <button
                      type="button"
                      aria-label={t("removePhotoAria")}
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
            ? t("uploadingPhoto")
            : photos.length
              ? t("addAnotherPhoto")
              : t("shareSet")}
        </Button>
      </div>

      <BodySm className="text-xs text-muted-foreground">
        {photos.length ? t("shareThanksBody") : t("sharePromptBody")}
      </BodySm>
    </div>
  )
}
