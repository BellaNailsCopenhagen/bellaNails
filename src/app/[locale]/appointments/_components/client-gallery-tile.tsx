"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { BodySm } from "@/components/ui/typography"
import { useJumpToPermissions } from "@/app/[locale]/appointments/_components/my-space-tabs"
import type { ClientMediaItem } from "@/modules/media/client-gallery"
import { pickReleaseCopy, type ReleasePurpose } from "@/shared/media-release"

/**
 * One photo/video in the client's Gallery: a clean masonry thumbnail (real
 * aspect ratio) that opens a full-size view. Every item is the ARTIST's — shot
 * at the studio and linked to the client through a booking; clients don't
 * upload. Whether the studio may publish an appointment's media is a
 * booking-level permission, decided on the Permissions tab — so the tile does not
 * ask for anything. It does REPORT: a client who allowed something is entitled
 * to see what was actually done with it, and where — and it leads to the control
 * that can take it back, because permission has to be as easy to withdraw as it
 * was to give (GDPR Art. 7(3)).
 */
export function ClientGalleryTile({
  item,
  locale,
  canManagePermission,
}: {
  item: ClientMediaItem
  locale: string
  /** False when this appointment has no permission card — a cancelled one, or
      one nobody has been asked about yet. Better no button than one that lands
      on a list with nothing highlighted. */
  canManagePermission: boolean
}) {
  const t = useTranslations("bookings")
  const [open, setOpen] = useState(false)
  const copy = pickReleaseCopy(locale)
  const jumpToPermissions = useJumpToPermissions()
  // A local const so the null-check narrows inside the handler below.
  const bookingId = item.bookingId

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

          {/* Permission is granted per APPOINTMENT, not per photo, so this leads
              to that appointment's card rather than offering a per-photo control
              it could not honour. */}
          {canManagePermission && bookingId && jumpToPermissions ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setOpen(false)
                jumpToPermissions(bookingId)
              }}
            >
              {t("seeInAppointment")}
            </Button>
          ) : null}
        </SheetContent>
      </Sheet>
    </li>
  )
}
