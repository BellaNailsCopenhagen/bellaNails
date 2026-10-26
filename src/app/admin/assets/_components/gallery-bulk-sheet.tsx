"use client"

import { useMemo, useState } from "react"
import { Check, Star } from "lucide-react"

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { BodySm } from "@/components/ui/typography"
import { FilterPill } from "@/app/admin/assets/_components/filter-pill"
import { useActionRunner } from "@/hooks/use-action-runner"
import { bulkAddToGallery } from "@/modules/media/asset-actions"
import type { HubAppointment, HubAsset } from "@/modules/media/asset-hub"
import { cn } from "@/shared/cn"

type Candidate = { asset: HubAsset }

/**
 * Bulk "add to website gallery" in one flow. Candidates are media whose booking
 * is RELEASED for the website but not yet on the gallery surface — start
 * all-selected; deselect to exclude. (Requesting a release is booking-level, done
 * from the booking card / hub, so this sheet only places already-released media.)
 */
export function GalleryBulkSheet({
  appointments,
  open,
  onOpenChange,
}: {
  appointments: HubAppointment[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { pending, run } = useActionRunner()
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [deselected, setDeselected] = useState<Set<string>>(new Set())

  const candidates: Candidate[] = useMemo(
    () =>
      appointments.flatMap((appointment) =>
        appointment.photos.flatMap((asset) => {
          // Everything here starts SELECTED, so anything she would not want
          // published has to be gone before she taps Add.
          if (asset.setAside) {
            return []
          }
          // Only appointments the client released for the website qualify.
          if (asset.releases.website !== "granted") {
            return []
          }
          const websitePublished = asset.published.find(
            (p) => p.purpose === "website",
          )
          const onGallery = (websitePublished?.usages ?? []).some(
            (u) => u.surface === "clients_gallery",
          )
          if (onGallery) {
            return []
          }

          return [{ asset }]
        }),
      ),
    [appointments],
  )

  const shown = favoritesOnly
    ? candidates.filter((c) => c.asset.favorited)
    : candidates
  const chosen = shown.filter((c) => !deselected.has(c.asset.mediaId))

  const toggle = (id: string) =>
    setDeselected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }

      return next
    })

  const submit = () =>
    run(async () => {
      const result = await bulkAddToGallery(chosen.map((c) => c.asset.mediaId))
      if (result.ok) {
        onOpenChange(false)
      }

      return result
    })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <SheetTitle>Add to website gallery</SheetTitle>
          <FilterPill
            icon={Star}
            fillWhenActive
            active={favoritesOnly}
            onToggle={() => setFavoritesOnly((v) => !v)}
          >
            Favourites
          </FilterPill>
        </div>

        {shown.length ? (
          <>
            <ul className="grid max-h-[46vh] grid-cols-3 gap-1.5 overflow-y-auto">
              {shown.map(({ asset }) => {
                const on = !deselected.has(asset.mediaId)

                return (
                  <li key={asset.mediaId}>
                    <button
                      type="button"
                      onClick={() => toggle(asset.mediaId)}
                      className={cn(
                        "relative block w-full overflow-hidden rounded-sm border-2 transition-colors",
                        on
                          ? "border-foreground"
                          : "border-transparent opacity-60",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset.url}
                        alt=""
                        className="aspect-square w-full object-cover"
                      />
                      {on ? (
                        <span className="absolute top-1 left-1 flex size-5 items-center justify-center rounded-full bg-foreground text-background">
                          <Check className="size-3" />
                        </span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>

            <BodySm className="text-xs text-muted-foreground">
              <span className="text-foreground">{chosen.length}</span> photo
              {chosen.length === 1 ? "" : "s"} → website gallery. All are
              released for the website and appear right away.
            </BodySm>

            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={pending || !chosen.length}
                onClick={submit}
              >
                {pending ? "Adding…" : `Add ${chosen.length} to gallery`}
              </Button>
            </div>
          </>
        ) : (
          <BodySm className="text-xs">
            Nothing to add — every eligible photo is already on the gallery,
            awaiting the client, or declined.
          </BodySm>
        )}
      </SheetContent>
    </Sheet>
  )
}
