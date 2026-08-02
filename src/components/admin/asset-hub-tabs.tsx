"use client"

import { useEffect, useState } from "react"

import { TabBar } from "@/components/ui/tab-bar"
import { EmptyState } from "@/components/ui/empty-state"
import { HubAssetCard } from "@/components/admin/hub-asset-card"
import type { HubAsset, HubState } from "@/lib/admin/asset-hub"

const ORDER: HubState[] = [
  "new",
  "awaiting",
  "unlinked",
  "in_use",
  "takedown",
  "declined",
  "withdrawn",
  "dismissed",
]

const LABEL: Record<HubState, string> = {
  new: "New",
  awaiting: "Awaiting",
  unlinked: "Unlinked",
  in_use: "In use",
  takedown: "Used & withdrawn",
  declined: "Declined",
  withdrawn: "Withdrawn",
  dismissed: "Dismissed",
}

/**
 * The asset hub's tab navigation — one tab per state, client-agnostic. Sections
 * are pre-grouped by state; this switches which shows. A `highlight` (from a
 * booking-card thumbnail) scrolls to that asset once its tab is active.
 */
export function AssetHubTabs({
  assets,
  clientNames,
  defaultTab,
  highlight,
}: {
  assets: HubAsset[]
  clientNames: Record<string, string>
  defaultTab: HubState
  highlight?: string | null
}) {
  const [tab, setTab] = useState<HubState>(defaultTab)

  const byState = new Map<HubState, HubAsset[]>()
  for (const a of assets) {
    const list = byState.get(a.state) ?? []
    list.push(a)
    byState.set(a.state, list)
  }

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
  }, [highlight, tab])

  const shown = byState.get(tab) ?? []
  const tabs = ORDER.map((state) => ({
    value: state,
    label: LABEL[state],
    count: byState.get(state)?.length || undefined,
  }))

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <TabBar tabs={tabs} active={tab} onChange={setTab} />
      </div>
      {shown.length ? (
        <ul className="columns-2 gap-4 sm:columns-3">
          {shown.map((asset) => (
            <HubAssetCard
              key={asset.mediaId}
              asset={asset}
              clientName={clientNames[asset.clerkUserId] ?? "Client"}
            />
          ))}
        </ul>
      ) : (
        <EmptyState title="Nothing here" body="No images in this state." />
      )}
    </div>
  )
}
