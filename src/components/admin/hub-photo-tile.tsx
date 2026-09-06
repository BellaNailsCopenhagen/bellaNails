"use client"

import { useState } from "react"
import { EyeOff, Star } from "lucide-react"

import { useActionRunner } from "@/hooks/use-action-runner"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { BodySm } from "@/components/ui/typography"
import { AssetUsageManager } from "@/components/admin/asset-usage-manager"
import {
  confirmTakedown,
  setMediaFavorite,
  setMediaSetAside,
} from "@/modules/media/asset-actions"
import type { HubAsset } from "@/modules/media/asset-hub"
import { SURFACE_LABELS } from "@/shared/asset-surfaces"
import { PUBLISHABLE_PURPOSES, isAwaitingUse } from "@/shared/asset-state"
import { cn } from "@/shared/cn"

const PURPOSE_LABEL: Record<string, string> = {
  website: "Website",
  social: "Social",
}

/** Every surface this photo currently sits on — the answer to "where is this
    one actually used", which used to need opening the sheet to find out. */
function placementsOf(photo: HubAsset): string[] {
  return photo.published.flatMap((copy) =>
    copy.usages.map(
      (usage) =>
        SURFACE_LABELS[usage.surface as keyof typeof SURFACE_LABELS] ??
        usage.surface,
    ),
  )
}

/**
 * One photo inside an appointment card. Permission is NOT here — it belongs to
 * the appointment and is shown once, above. What is here is what differs photo
 * by photo: where this one is used, whether it is new, and the artist's own
 * marks on it.
 */
export function HubPhotoTile({
  photo,
  releases,
  now,
  autoOpen = false,
}: {
  photo: HubAsset
  /** The appointment's answers — this photo may only go where they allow. */
  releases: Record<string, string>
  now: number
  autoOpen?: boolean
}) {
  const [open, setOpen] = useState(autoOpen)
  const { pending, run } = useActionRunner()

  const placements = placementsOf(photo)
  const isNew = isAwaitingUse(photo, now)
  const needsTakedown = photo.published.find((copy) => copy.needsTakedown)

  return (
    <li id={`media-${photo.mediaId}`} className="space-y-1">
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "block w-full overflow-hidden rounded-sm border border-border",
            photo.setAside && "opacity-45",
          )}
        >
          {photo.kind === "video" ? (
            <video
              src={photo.url}
              preload="metadata"
              className="aspect-square w-full object-cover"
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={photo.url}
              alt=""
              className="aspect-square w-full object-cover"
            />
          )}
        </button>

        {isNew ? (
          <span className="absolute top-1 left-1 rounded-full bg-foreground px-1.5 py-0.5 font-functional text-[0.5rem] uppercase tracking-widest-lux text-background">
            New
          </span>
        ) : null}

        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() => setMediaFavorite(photo.mediaId, !photo.favorited))
          }
          aria-label={photo.favorited ? "Remove favourite" : "Favourite"}
          className={cn(
            "absolute top-1 right-1 flex size-5 items-center justify-center rounded-full border shadow-sm backdrop-blur-sm",
            photo.favorited
              ? "border-transparent bg-secondary"
              : "border-border bg-background/85",
          )}
        >
          <Star
            className={cn(
              "size-3",
              photo.favorited
                ? "fill-secondary-foreground text-secondary-foreground"
                : "text-muted-foreground",
            )}
          />
        </button>

        {photo.setAside ? (
          <EyeOff
            className="absolute bottom-1 right-1 size-3 text-muted-foreground"
            aria-label="Set aside"
          />
        ) : null}
      </div>

      {/* Where it is used, on the tile — no opening required. */}
      <p className="truncate font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground">
        {needsTakedown
          ? "take it down"
          : placements.length
            ? placements.join(" · ")
            : "not used"}
      </p>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="space-y-5">
          <SheetTitle>Where this photo is used</SheetTitle>

          {photo.kind === "video" ? (
            <video
              src={photo.url}
              controls
              className="max-h-72 w-full rounded-sm border border-border object-contain"
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={photo.url}
              alt=""
              className="max-h-72 w-full rounded-sm border border-border object-contain"
            />
          )}

          {PUBLISHABLE_PURPOSES.map((purpose) => {
            const status = releases[purpose] ?? "none"
            const published = photo.published.find((c) => c.purpose === purpose)
            return (
              <div
                key={purpose}
                className="space-y-2 border-t border-border pt-4"
              >
                <span className="font-functional text-sm text-foreground">
                  {PURPOSE_LABEL[purpose]}
                </span>

                {published?.needsTakedown ? (
                  <div className="space-y-1">
                    <BodySm className="text-xs text-destructive/80">
                      Permission was taken back — remove the post, then confirm.
                    </BodySm>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={pending}
                      onClick={() => run(() => confirmTakedown(published.assetId))}
                    >
                      Confirm taken down
                    </Button>
                  </div>
                ) : status === "granted" ? (
                  <AssetUsageManager
                    mediaId={photo.mediaId}
                    purpose={purpose}
                    published={published}
                  />
                ) : (
                  /* Permission is the appointment's, so it is asked for up on the
                     appointment card — saying so beats a dead control here. */
                  <BodySm className="text-xs text-muted-foreground">
                    Not allowed yet — ask for this appointment above.
                  </BodySm>
                )}
              </div>
            )
          })}

          <div className="border-t border-border pt-4">
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                run(() => setMediaSetAside(photo.mediaId, !photo.setAside))
              }
            >
              {photo.setAside ? "Put back" : "Set aside — not using this one"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </li>
  )
}
