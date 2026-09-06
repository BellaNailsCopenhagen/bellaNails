"use client"

import { useEffect, useState } from "react"
import { EyeOff, Images, Info, Sparkles, Star, TriangleAlert } from "lucide-react"

import { TabBar } from "@/components/ui/tab-bar"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { flashHighlight } from "@/components/admin/highlight-target"
import { HubAppointmentCard } from "@/components/admin/hub-appointment-card"
import { GalleryBulkSheet } from "@/app/admin/assets/_components/gallery-bulk-sheet"
import { FilterPill } from "@/app/admin/assets/_components/filter-pill"
import type { HubAppointment } from "@/modules/media/asset-hub"
import { STATE_ICON } from "@/components/admin/asset-state"
import {
  ASSET_STATE_LABEL,
  ASSET_STATE_ORDER,
  ASSET_STATE_TOOLTIP,
  isAwaitingUse,
  type AssetState,
} from "@/shared/asset-state"
import { cn } from "@/shared/cn"

export type HubFilter = "all" | "takedown" | AssetState

/**
 * The hub's navigation, over APPOINTMENTS rather than loose photos — permission
 * is given per appointment, so that is the unit a state describes.
 *
 * Three things deliberately stay off the tab strip. "Needs takedown" is an
 * alarm, not a stage. "New" is about when a photo arrived, not what it needs.
 * And set-aside is the artist's own filing, true in any state. All three are
 * controls beside the tabs instead.
 */
export function AssetHubTabs({
  appointments,
  clientNames,
  defaultTab = "all",
  highlight,
  now,
}: {
  appointments: HubAppointment[]
  clientNames: Record<string, string>
  defaultTab?: HubFilter
  highlight?: string | null
  now: number
}) {
  const [tab, setTab] = useState<HubFilter>(defaultTab)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [newOnly, setNewOnly] = useState(false)
  const [showSetAside, setShowSetAside] = useState(false)
  const [legendOpen, setLegendOpen] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)

  // Counted over the shelf each pill actually opens: set-aside photos are hidden
  // until its own pill is on, so counting them under "new" or "favourites"
  // promised photos those filters would then hide.
  let favCount = 0
  let setAsideCount = 0
  let newCount = 0
  for (const appointment of appointments) {
    for (const photo of appointment.photos) {
      if (photo.setAside) {
        setAsideCount++
        continue
      }
      if (photo.favorited) favCount++
      if (isAwaitingUse(photo, now)) newCount++
    }
  }

  // The marks filter PHOTOS, so an appointment survives while it still has one
  // to show. Set aside is hidden by default — that is what setting a photo aside
  // means — and turning it on shows the shelf instead.
  const keepPhoto = (photo: HubAppointment["photos"][number]) =>
    (!favoritesOnly || photo.favorited) &&
    (!newOnly || isAwaitingUse(photo, now)) &&
    (showSetAside ? photo.setAside : !photo.setAside)

  const visible = appointments.flatMap((appointment) => {
    // Never filtered away: an alarm the artist must not be able to file, and the
    // photo a deep link points at — otherwise the alert lands on an empty page.
    const forced =
      appointment.state === "takedown" ||
      appointment.photos.some((p) => p.mediaId === highlight)
    const photos = forced
      ? appointment.photos
      : appointment.photos.filter(keepPhoto)
    return photos.length ? [{ ...appointment, photos }] : []
  })

  // Counted over what the tabs will actually list, so a badge can never promise
  // appointments the controls beside it are hiding.
  const countByState = new Map<AssetState, number>()
  for (const a of visible) {
    countByState.set(a.state, (countByState.get(a.state) ?? 0) + 1)
  }
  const takedownCount = countByState.get("takedown") ?? 0

  const shown = visible.filter((a) => tab === "all" || a.state === tab)

  useEffect(() => {
    if (!highlight) return
    return flashHighlight(`media-${highlight}`)
  }, [highlight, tab, favoritesOnly, newOnly, showSetAside])

  const tabs = [
    { value: "all" as HubFilter, label: "All", count: visible.length || undefined },
    ...ASSET_STATE_ORDER.map((state) => ({
      value: state as HubFilter,
      label: ASSET_STATE_LABEL[state],
      count: countByState.get(state) || undefined,
    })),
    // Only while there is one. It is an alarm, not a stage — but the banner and a
    // ?tab= link both select it, and a value with no tab leaves the whole strip
    // reading unselected with no clue what the list is filtered to.
    ...(takedownCount
      ? [
          {
            value: "takedown" as HubFilter,
            label: ASSET_STATE_LABEL.takedown,
            count: takedownCount,
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-6">
      {takedownCount > 0 && tab !== "takedown" ? (
        <button
          type="button"
          onClick={() => setTab("takedown")}
          className="flex w-full items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-left transition-colors hover:border-destructive"
        >
          <TriangleAlert className="size-4 shrink-0 text-destructive" />
          <span className="font-functional text-sm text-foreground">
            {takedownCount === 1
              ? "1 appointment needs a photo taken down from social"
              : `${takedownCount} appointments need photos taken down from social`}
            <span className="ml-2 font-functional text-xs text-muted-foreground">
              permission was taken back — tap to deal with it
            </span>
          </span>
        </button>
      ) : null}

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
        <FilterPill
          icon={Sparkles}
          active={newOnly}
          onToggle={() => setNewOnly((v) => !v)}
          title="Just added, not used anywhere yet"
        >
          {newCount}
        </FilterPill>
        <FilterPill
          icon={Star}
          fillWhenActive
          active={favoritesOnly}
          onToggle={() => setFavoritesOnly((v) => !v)}
          title="Show favourites only"
        >
          {favCount}
        </FilterPill>
        <FilterPill
          icon={EyeOff}
          active={showSetAside}
          onToggle={() => setShowSetAside((v) => !v)}
          title="Show the ones you set aside"
        >
          {setAsideCount}
        </FilterPill>
      </div>

      <Sheet open={legendOpen} onOpenChange={setLegendOpen}>
        <SheetContent className="space-y-4">
          <SheetTitle>What the states mean</SheetTitle>
          <p className="font-functional text-xs text-muted-foreground">
            A state describes an APPOINTMENT, not a photo. The client answers once
            per appointment and that answer covers every photo taken at it.
          </p>
          <ul className="space-y-3">
            {[...ASSET_STATE_ORDER, "takedown" as const].map((state) => {
              const { Icon, className } = STATE_ICON[state]
              return (
                <li key={state} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-border">
                    <Icon className={cn("size-3.5", className)} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-functional text-sm text-foreground">
                      {ASSET_STATE_LABEL[state]}
                    </p>
                    <p className="font-functional text-xs text-muted-foreground">
                      {ASSET_STATE_TOOLTIP[state]}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="font-functional text-xs text-muted-foreground">
            The three marks beside the tabs filter photos, not appointments:
            just-added, your shortlist, and the shelf you’ve set aside.
          </p>
        </SheetContent>
      </Sheet>

      {shown.length ? (
        <ul className="space-y-4">
          {shown.map((appointment) => (
            <HubAppointmentCard
              key={appointment.key}
              appointment={appointment}
              clientName={clientNames[appointment.clientId] ?? "Client"}
              now={now}
              highlight={highlight}
            />
          ))}
        </ul>
      ) : (
        <EmptyState
          title="Nothing here"
          body={
            showSetAside
              ? "You haven’t set any photos aside."
              : newOnly
                ? "Nothing new waiting to be used."
                : "No appointments match this filter."
          }
        />
      )}

      <GalleryBulkSheet
        appointments={appointments}
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
      />
    </div>
  )
}
