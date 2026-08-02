"use client"

import { useState } from "react"

import { useActionRunner } from "@/lib/hooks/use-action-runner"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BodySm } from "@/components/ui/typography"
import { AssetUsageManager } from "@/components/admin/asset-usage-manager"
import {
  requestBothPublish,
  requestMediaPublish,
} from "@/lib/actions/manage-media"
import { confirmTakedown, setMediaDismissed } from "@/lib/actions/manage-assets"
import type { HubAsset, HubState } from "@/lib/admin/asset-hub"
import type { MediaPurpose } from "@/lib/media"
import { cn } from "@/lib/utils"

const PURPOSES: { key: MediaPurpose; label: string; request: string }[] = [
  { key: "site", label: "Website", request: "Request website" },
  { key: "some", label: "Social", request: "Request social" },
]

// grey = idle/gone · amber = pending/unplaced · green = live · red = needs action
const DOT: Record<HubState, string> = {
  new: "bg-muted-foreground/40",
  awaiting: "bg-secondary",
  unlinked: "bg-secondary",
  in_use: "bg-success",
  declined: "bg-destructive",
  withdrawn: "bg-muted-foreground/40",
  takedown: "bg-destructive",
  dismissed: "bg-muted-foreground/30",
}

const canRequest = (status?: string) =>
  !status || status === "declined" || status === "withdrawn"

export function HubAssetCard({
  asset,
  clientName,
}: {
  asset: HubAsset
  clientName: string
}) {
  const [open, setOpen] = useState(false)
  const { pending, run } = useActionRunner()

  return (
    <li
      id={`media-${asset.mediaId}`}
      className="mb-4 break-inside-avoid space-y-1.5 rounded-sm transition-shadow"
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full overflow-hidden rounded-sm border border-border"
      >
        {asset.kind === "video" ? (
          <video src={asset.url} preload="metadata" className="w-full" />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={asset.url} alt="" className="w-full" />
        )}
      </button>
      <div className="flex items-center gap-2">
        <span className={cn("size-2 shrink-0 rounded-full", DOT[asset.state])} />
        <span className="truncate font-functional text-xs text-muted-foreground">
          {clientName}
        </span>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="space-y-5">
          <SheetTitle>Manage image</SheetTitle>

          {asset.kind === "video" ? (
            <video
              src={asset.url}
              controls
              className="max-h-72 w-full rounded-sm border border-border object-contain"
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={asset.url}
              alt=""
              className="max-h-72 w-full rounded-sm border border-border object-contain"
            />
          )}
          <BodySm className="text-xs">
            {clientName} · {asset.source === "client" ? "client upload" : "studio"}
          </BodySm>

          {canRequest(asset.consents.site?.status) &&
          canRequest(asset.consents.some?.status) ? (
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                run(() => requestBothPublish(asset.mediaId, asset.clerkUserId))
              }
            >
              Request website &amp; social
            </Button>
          ) : null}

          {PURPOSES.map(({ key, label, request }) => {
            const consent = asset.consents[key]
            return (
              <div key={key} className="space-y-2 border-t border-border pt-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-functional text-sm text-foreground">
                    {label}
                  </span>
                  <Badge variant="outline" size="xs">
                    {consent?.needsTakedown
                      ? "taken down?"
                      : (consent?.status ?? "not shared")}
                  </Badge>
                </div>

                {consent?.needsTakedown ? (
                  <div className="space-y-1">
                    <BodySm className="text-xs text-destructive/80">
                      Client withdrew — remove the post, then confirm.
                    </BodySm>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={pending}
                      onClick={() => run(() => confirmTakedown(consent.id))}
                    >
                      Confirm taken down
                    </Button>
                  </div>
                ) : consent?.status === "granted" && consent.publishedAssetId ? (
                  <AssetUsageManager
                    assetId={consent.publishedAssetId}
                    purpose={key}
                    usages={consent.usages}
                  />
                ) : consent?.status === "requested" ? (
                  <BodySm className="text-xs">Waiting on the client…</BodySm>
                ) : canRequest(consent?.status) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        requestMediaPublish(asset.mediaId, asset.clerkUserId, key),
                      )
                    }
                  >
                    {request}
                  </Button>
                ) : null}
              </div>
            )
          })}

          <div className="border-t border-border pt-4">
            {asset.dismissed ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => run(() => setMediaDismissed(asset.mediaId, false))}
              >
                Restore to New
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => run(() => setMediaDismissed(asset.mediaId, true))}
              >
                Dismiss — not using
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </li>
  )
}
