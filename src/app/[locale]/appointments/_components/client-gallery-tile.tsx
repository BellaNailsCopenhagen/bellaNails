"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import type { ClientMediaItem } from "@/modules/media/client-gallery"

/**
 * One photo/video in the client's Gallery: a clean masonry thumbnail (real
 * aspect ratio) that opens a full-size view. Every item is the ARTIST's — shot
 * at the studio and linked to the client through a booking; clients don't
 * upload. Whether the studio may PUBLISH an appointment's media is a
 * booking-level release, managed from the per-booking release cards, so the
 * tile stays purely a gallery.
 */
export function ClientGalleryTile({ item }: { item: ClientMediaItem }) {
  const t = useTranslations("bookings")
  const [open, setOpen] = useState(false)

  return (
    <li className="mb-4 break-inside-avoid">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={item.caption ?? t("viewPhoto")}
        className="block w-full overflow-hidden rounded-sm border border-border transition-opacity hover:opacity-90"
      >
        {item.kind === "video" ? (
          <video src={item.url} preload="metadata" className="w-full" />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={item.url} alt="" className="w-full" />
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="space-y-5">
          <SheetTitle>{t("photoTitle")}</SheetTitle>

          {item.kind === "video" ? (
            <video
              src={item.url}
              controls
              className="max-h-[60vh] w-full rounded-sm border border-border object-contain"
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={item.url}
              alt={item.caption ?? ""}
              className="max-h-[60vh] w-full rounded-sm border border-border object-contain"
            />
          )}

        </SheetContent>
      </Sheet>
    </li>
  )
}
