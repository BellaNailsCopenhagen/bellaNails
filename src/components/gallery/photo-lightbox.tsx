"use client"

import { useState } from "react"
import { Dialog } from "@base-ui/react/dialog"
import { X } from "lucide-react"
import { useTranslations } from "next-intl"

/**
 * PhotoLightbox — one client photo over a dimmed page, at the stored file's own
 * size, bounded by the viewport. Controlled, so one lightbox serves a grid.
 *
 * Same URL as the tile it was opened from: the tile already fetched those bytes,
 * so opening costs nothing.
 */
export function PhotoLightbox({
  src,
  alt,
  onClose,
}: {
  src: string | null
  alt: string
  onClose: () => void
}) {
  const t = useTranslations("photo")
  // The popup stays mounted through its 200ms fade, so the photo has to outlive
  // `src` — dropping it on close blinks the image out mid-animation.
  const [shown, setShown] = useState(src)
  if (src !== null && src !== shown) {
    setShown(src)
  }

  return (
    <Dialog.Root
      open={src !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/70 backdrop-blur-[2px] transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup
          data-slot="photo-lightbox"
          className="fixed top-1/2 left-1/2 z-50 max-h-[90vh] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 outline-none transition-all duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0"
        >
          {/* The image is the dialog's content; its alt is the accessible name. */}
          <Dialog.Title className="sr-only">{alt}</Dialog.Title>
          {shown ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={shown}
              alt={alt}
              className="max-h-[90vh] max-w-[92vw] rounded-sm object-contain shadow-xl"
            />
          ) : null}
          <Dialog.Close
            aria-label={t("close")}
            className="absolute top-2 right-2 rounded-full bg-background/80 p-2 text-foreground shadow-sm outline-none backdrop-blur-sm transition-colors hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <X className="size-4" />
          </Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
