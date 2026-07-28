"use client"

import { useTranslations } from "next-intl"
import { X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { DeleteOwnMediaButton } from "@/components/sections/delete-own-media-button"
import type { ClientMediaItem, ConsentStatus } from "@/lib/media"

/**
 * The client's own Gallery tab: a grid of their images/videos. Each shows
 * whether it's shared to the studio's website / social (granted publish
 * consent), so the client always sees where their photo appears. They can
 * remove their OWN uploads (confirmed — deletion is real erasure); studio
 * photos are managed by the studio, and publishing is decided in Requests.
 */
export function ClientGallery({ media }: { media: ClientMediaItem[] }) {
  const t = useTranslations("bookings")

  if (!media.length) {
    return (
      <EmptyState
        title={t("galleryEmptyTitle")}
        body={t("galleryEmptyBody")}
      />
    )
  }

  const deleteLabels = {
    title: t("deleteTitle"),
    body: t("deleteBody"),
    confirm: t("deleteConfirm"),
    confirming: t("deleteConfirming"),
    cancel: t("deleteCancel"),
    failed: t("loadError"),
  }

  const shareBadge = (label: string, status: ConsentStatus) => (
    <Badge variant={status === "granted" ? "success" : "outline"} size="xs">
      {label}: {status === "granted" ? t("shareShared") : t("sharePrivate")}
    </Badge>
  )

  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {media.map((item) => (
        <li key={item.id} className="space-y-2">
          <div className="relative">
            {item.kind === "video" ? (
              <video
                src={item.url}
                controls
                preload="metadata"
                className="aspect-square w-full rounded-sm border border-border object-cover"
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={item.url}
                alt={item.caption ?? "Photo"}
                className="aspect-square w-full rounded-sm border border-border object-cover"
              />
            )}
            {item.source === "client" ? (
              <DeleteOwnMediaButton
                mediaId={item.id}
                labels={deleteLabels}
                trigger={
                  <button
                    type="button"
                    aria-label={t("deleteConfirm")}
                    className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                }
              />
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1">
            {shareBadge(t("shareWebsite"), item.site)}
            {shareBadge(t("shareSocial"), item.some)}
          </div>
        </li>
      ))}
    </ul>
  )
}
