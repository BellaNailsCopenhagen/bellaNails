"use client"

import { useState } from "react"
import { Star } from "lucide-react"

import { useActionRunner } from "@/hooks/use-action-runner"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BodySm } from "@/components/ui/typography"
import { AssetUsageManager } from "@/components/admin/asset-usage-manager"
import {
  requestBothPublish,
  requestMediaPublish,
} from "@/modules/media/owner-media-actions"
import {
  confirmTakedown,
  setMediaDismissed,
  setMediaFavorite,
} from "@/modules/media/asset-actions"
import type { HubAsset } from "@/modules/media/asset-hub"
import {
  SIMPLE_LABEL,
  SIMPLE_TOOLTIP,
  STATE_ICON,
  toSimpleState,
} from "@/components/admin/asset-state"
import type { MediaPurpose } from "@/modules/media/client-gallery"
import { cn } from "@/shared/cn"

const PURPOSES: { key: MediaPurpose; label: string; request: string }[] = [
  { key: "site", label: "Website", request: "Request website" },
  { key: "some", label: "Social", request: "Request social" },
]

const canRequest = (status?: string) =>
  !status || status === "declined" || status === "withdrawn"

export function HubAssetCard({
  asset,
  clientName,
  showClient = true,
  autoOpen = false,
}: {
  asset: HubAsset
  clientName: string
  showClient?: boolean
  autoOpen?: boolean
}) {
  const [open, setOpen] = useState(autoOpen)
  const { pending, run } = useActionRunner()

  const simple = toSimpleState(asset.state)
  const { Icon: StateIcon, className: stateClass } = STATE_ICON[simple]

  return (
    <li
      id={`media-${asset.mediaId}`}
      className="mb-4 break-inside-avoid space-y-1.5 rounded-sm transition-shadow"
    >
      <div className="relative">
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
        <span
          title={SIMPLE_TOOLTIP[simple]}
          className="absolute top-1.5 left-1.5 flex size-6 items-center justify-center rounded-full border border-border bg-background/85 shadow-sm backdrop-blur-sm"
        >
          <StateIcon className={cn("size-3.5", stateClass)} />
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() => setMediaFavorite(asset.mediaId, !asset.favorited))
          }
          aria-label={asset.favorited ? "Remove favourite" : "Favourite"}
          title={asset.favorited ? "Favourited" : "Favourite"}
          className={cn(
            "absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full border shadow-sm backdrop-blur-sm transition-transform hover:scale-105",
            asset.favorited
              ? "border-transparent bg-secondary"
              : "border-border bg-background/85",
          )}
        >
          <Star
            className={cn(
              "size-3.5",
              asset.favorited
                ? "fill-secondary-foreground text-secondary-foreground"
                : "text-muted-foreground",
            )}
          />
        </button>
      </div>
      <div className="flex items-center gap-1.5" title={SIMPLE_TOOLTIP[simple]}>
        <span className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground">
          {SIMPLE_LABEL[simple]}
        </span>
        {showClient ? (
          <span className="truncate font-functional text-xs text-muted-foreground">
            · {clientName}
          </span>
        ) : null}
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
            {showClient ? `${clientName} · ` : ""}
            {asset.source === "client" ? "client upload" : "studio"}
          </BodySm>

          {canRequest(asset.consents.site?.status) &&
          canRequest(asset.consents.some?.status) ? (
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                run(() => requestBothPublish(asset.mediaId, asset.clientId))
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
                        requestMediaPublish(asset.mediaId, asset.clientId, key),
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
