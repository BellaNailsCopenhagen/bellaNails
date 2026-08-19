"use client"

import { useMemo, useState } from "react"
import { Check } from "lucide-react"

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { BodySm } from "@/components/ui/typography"
import { FavouritesToggle } from "@/components/admin/favourites-toggle"
import { useActionRunner } from "@/lib/hooks/use-action-runner"
import { bulkAddToGallery } from "@/lib/actions/manage-assets"
import type { HubAsset } from "@/lib/admin/asset-hub"
import { cn } from "@/lib/utils"

type Candidate = { asset: HubAsset; ready: boolean }

/**
 * Bulk "add to website gallery" in one flow. Candidates (not already on the
 * gallery, not pending/declined for the site) start all-selected; deselect to
 * exclude. "Ready" photos go up now; the rest get a consent request that
 * auto-places on grant.
 */
export function GalleryBulkSheet({
  assets,
  open,
  onOpenChange,
}: {
  assets: HubAsset[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { pending, run } = useActionRunner()
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [deselected, setDeselected] = useState<Set<string>>(new Set())

  const candidates: Candidate[] = useMemo(
    () =>
      assets.flatMap((asset) => {
        const site = asset.consents.site
        const onGallery = (site?.usages ?? []).some(
          (u) => u.surface === "clients_gallery",
        )
        // Skip if live, pending, or the client already said no (declined/withdrawn).
        if (
          onGallery ||
          site?.status === "requested" ||
          site?.status === "declined" ||
          site?.status === "withdrawn"
        )
          return []
        const ready = site?.status === "granted" && Boolean(site.publishedAssetId)
        return [{ asset, ready }]
      }),
    [assets],
  )

  const shown = favoritesOnly
    ? candidates.filter((c) => c.asset.favorited)
    : candidates
  const chosen = shown.filter((c) => !deselected.has(c.asset.mediaId))
  const readyCount = chosen.filter((c) => c.ready).length
  const requestCount = chosen.length - readyCount

  const toggle = (id: string) =>
    setDeselected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const submit = () =>
    run(async () => {
      const result = await bulkAddToGallery(chosen.map((c) => c.asset.mediaId))
      if (result.ok) onOpenChange(false)
      return result
    })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <SheetTitle>Add to website gallery</SheetTitle>
          <FavouritesToggle
            active={favoritesOnly}
            onToggle={() => setFavoritesOnly((v) => !v)}
          >
            Favourites
          </FavouritesToggle>
        </div>

        {shown.length ? (
          <>
            <ul className="grid max-h-[46vh] grid-cols-3 gap-1.5 overflow-y-auto">
              {shown.map(({ asset, ready }) => {
                const on = !deselected.has(asset.mediaId)
                return (
                  <li key={asset.mediaId}>
                    <button
                      type="button"
                      onClick={() => toggle(asset.mediaId)}
                      className={cn(
                        "relative block w-full overflow-hidden rounded-sm border-2 transition-colors",
                        on ? "border-foreground" : "border-transparent opacity-60",
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
                      <span
                        className={cn(
                          "absolute right-1 bottom-1 rounded-full px-1.5 py-0.5 font-functional text-[0.5rem] uppercase tracking-widest-lux",
                          ready
                            ? "bg-success/90 text-background"
                            : "bg-warning/90 text-background",
                        )}
                      >
                        {ready ? "ready" : "will ask"}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>

            <BodySm className="text-xs text-muted-foreground">
              <span className="text-foreground">{chosen.length}</span> photo
              {chosen.length === 1 ? "" : "s"} → website gallery.{" "}
              {readyCount > 0
                ? `${readyCount} already approved (show right away). `
                : ""}
              {requestCount > 0
                ? `${requestCount} need the client's OK — we ask automatically and they appear once granted.`
                : ""}
            </BodySm>

            <div className="flex justify-end">
              <Button size="sm" disabled={pending || !chosen.length} onClick={submit}>
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
