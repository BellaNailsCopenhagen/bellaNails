"use client"

import { useEffect, useState } from "react"
import { Images, Info } from "lucide-react"

import { TabBar } from "@/components/ui/tab-bar"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { HubAssetCard } from "@/components/admin/hub-asset-card"
import { GalleryBulkSheet } from "@/components/admin/gallery-bulk-sheet"
import { FavouritesToggle } from "@/components/admin/favourites-toggle"
import type { HubAsset } from "@/lib/admin/asset-hub"
import {
  SIMPLE_LABEL,
  SIMPLE_ORDER,
  SIMPLE_TOOLTIP,
  STATE_ICON,
  toSimpleState,
  type SimpleState,
} from "@/lib/asset-state"
import { cn } from "@/lib/utils"

export type HubFilter = "all" | SimpleState

/**
 * The asset hub navigation: an "All" view plus one tab per simplified state
 * (asset-state.ts), with a favourites-only toggle that filters within any tab.
 * Per-asset state shows as an icon + tooltip on the card. A `highlight` (from a
 * booking-card thumbnail or a consent-withdrawal notification) scrolls to that
 * asset and opens its dialog.
 */
export function AssetHubTabs({
  assets,
  clientNames,
  defaultTab = "all",
  highlight,
}: {
  assets: HubAsset[]
  clientNames: Record<string, string>
  defaultTab?: HubFilter
  highlight?: string | null
}) {
  const [tab, setTab] = useState<HubFilter>(defaultTab)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [legendOpen, setLegendOpen] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)

  const countByState = new Map<SimpleState, number>()
  let favCount = 0
  for (const a of assets) {
    const s = toSimpleState(a.state)
    countByState.set(s, (countByState.get(s) ?? 0) + 1)
    if (a.favorited) favCount++
  }

  const shown = assets.filter(
    (a) =>
      (tab === "all" || toSimpleState(a.state) === tab) &&
      (!favoritesOnly || a.favorited),
  )

  useEffect(() => {
    if (!highlight) return
    const el = document.getElementById(`media-${highlight}`)
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    el.classList.add("ring-2", "ring-foreground", "ring-offset-2")
    const timer = setTimeout(
      () => el.classList.remove("ring-2", "ring-foreground", "ring-offset-2"),
      2200,
    )
    return () => clearTimeout(timer)
  }, [highlight, tab, favoritesOnly])

  const tabs = [
    { value: "all" as HubFilter, label: "All", count: assets.length || undefined },
    ...SIMPLE_ORDER.map((state) => ({
      value: state as HubFilter,
      label: SIMPLE_LABEL[state],
      count: countByState.get(state) || undefined,
    })),
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setGalleryOpen(true)}>
          <Images className="size-4" />
          Add to website gallery
        </Button>
      </div>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 overflow-x-auto">
          <TabBar tabs={tabs} active={tab} onChange={setTab} />
        </div>
        <button
          type="button"
          onClick={() => setLegendOpen(true)}
          aria-label="What the states mean"
          title="What the states mean"
          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
        >
          <Info className="size-4" />
        </button>
        <FavouritesToggle
          active={favoritesOnly}
          onToggle={() => setFavoritesOnly((v) => !v)}
          title="Show favourites only"
        >
          {favCount}
        </FavouritesToggle>
      </div>

      <Sheet open={legendOpen} onOpenChange={setLegendOpen}>
        <SheetContent className="space-y-4">
          <SheetTitle>What the states mean</SheetTitle>
          <ul className="space-y-3">
            {SIMPLE_ORDER.map((state) => {
              const { Icon, className } = STATE_ICON[state]
              return (
                <li key={state} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-border">
                    <Icon className={cn("size-3.5", className)} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-functional text-sm text-foreground">
                      {SIMPLE_LABEL[state]}
                    </p>
                    <p className="font-functional text-xs text-muted-foreground">
                      {SIMPLE_TOOLTIP[state]}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="font-functional text-xs text-muted-foreground">
            The ⭐ marks your favourites — set it on any photo, in any state.
          </p>
        </SheetContent>
      </Sheet>
      {shown.length ? (
        <ul className="columns-2 gap-4 sm:columns-3">
          {shown.map((asset) => (
            <HubAssetCard
              key={asset.mediaId}
              asset={asset}
              clientName={clientNames[asset.clientId] ?? "Client"}
              autoOpen={highlight != null && asset.mediaId === highlight}
            />
          ))}
        </ul>
      ) : (
        <EmptyState title="Nothing here" body="No images match this filter." />
      )}

      <GalleryBulkSheet
        assets={assets}
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
      />
    </div>
  )
}
