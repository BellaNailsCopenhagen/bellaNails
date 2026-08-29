"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { DeleteOwnMediaButton } from "@/app/[locale]/appointments/_components/delete-own-media-button"
import { withdrawPill } from "@/components/ui/confirm-action-button"
import type { ClientMediaItem } from "@/modules/media/client-gallery"

/**
 * One photo/video in the client's Gallery: a clean masonry thumbnail (real aspect
 * ratio) that opens a full-size view. Whether the studio may PUBLISH this
 * appointment's media is a booking-level release, managed from the per-booking
 * release cards — not per photo — so the tile stays a gallery. A client can still
 * delete their own uploads here.
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

          {item.source === "client" ? (
            <div className="border-t border-border pt-4">
              <DeleteOwnMediaButton
                mediaId={item.id}
                labels={{
                  title: t("deleteTitle"),
                  body: t("deleteBody"),
                  confirm: t("deleteConfirm"),
                  confirming: t("deleteConfirming"),
                  cancel: t("deleteCancel"),
                  failed: t("loadError"),
                }}
                trigger={
                  <button type="button" className={withdrawPill}>
                    {t("deletePhotoCta")}
                  </button>
                }
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </li>
  )
}
