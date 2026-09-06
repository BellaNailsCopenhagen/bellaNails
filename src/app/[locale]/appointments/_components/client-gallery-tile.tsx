"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { BodySm } from "@/components/ui/typography"
import type { ClientMediaItem } from "@/modules/media/client-gallery"
import { pickReleaseCopy, type ReleasePurpose } from "@/shared/media-release"

/**
 * One photo/video in the client's Gallery: a clean masonry thumbnail (real
 * aspect ratio) that opens a full-size view. Every item is the ARTIST's — shot
 * at the studio and linked to the client through a booking; clients don't
 * upload. Whether the studio may publish an appointment's media is a
 * booking-level permission, decided on the Permissions tab — so the tile does not
 * ask for anything. It does REPORT: a client who allowed something is entitled
 * to see what was actually done with it, and where.
 */
export function ClientGalleryTile({
  item,
  locale,
}: {
  item: ClientMediaItem
  locale: string
}) {
  const t = useTranslations("bookings")
  const [open, setOpen] = useState(false)
  const copy = pickReleaseCopy(locale)

  // One line per place it is shown, named the way the permission page named it.
  const shownIn = item.usedOn.map(
    ({ surface, purpose }) =>
      `${copy.purposes[purpose as ReleasePurpose]?.label ?? purpose}${
        surface === "showcase" ? ` · ${t("usedOnHome")}` : ""
      }`,
  )
  const uniqueShownIn = [...new Set(shownIn)]

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

          <div className="space-y-1 border-t border-border pt-4">
            <p className="font-functional text-[10px] uppercase tracking-widest-lux text-muted-foreground">
              {t("usedWhere")}
            </p>
            {uniqueShownIn.length ? (
              <ul className="space-y-1">
                {uniqueShownIn.map((line) => (
                  <li
                    key={line}
                    className="font-functional text-sm text-foreground"
                  >
                    {line}
                  </li>
                ))}
              </ul>
            ) : (
              <BodySm className="text-xs text-muted-foreground">
                {t("usedNowhere")}
              </BodySm>
            )}
            <BodySm className="text-xs text-muted-foreground">
              {t("usedManageNote")}
            </BodySm>
          </div>
        </SheetContent>
      </Sheet>
    </li>
  )
}
