"use client"

import { useTranslations } from "next-intl"
import { X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Eyebrow } from "@/components/ui/typography"
import { EmptyState } from "@/components/ui/empty-state"
import { DeleteOwnMediaButton } from "@/components/sections/delete-own-media-button"
import { ConfirmActionButton } from "@/components/sections/confirm-action-button"
import { withdrawMediaConsent } from "@/lib/actions/client-consent"
import type {
  ClientMediaItem,
  ConsentStatus,
  MediaPurpose,
} from "@/lib/media"

// Small red "only touch if you mean to" pill for the destructive withdraw.
const withdrawPill =
  "self-start rounded-full border border-destructive/40 px-2 py-0.5 font-functional text-[0.5625rem] uppercase tracking-widest-lux text-destructive/80 transition-colors hover:border-destructive hover:text-destructive"

/**
 * The client's Gallery tab, split into "Your photos" and "From Bella Nails"
 * (studio-added). Each image shows where it's shared (website / social); the
 * client can stop sharing (withdraw) right here, and remove their OWN uploads.
 * Images keep their real aspect ratio (masonry). Studio photos are studio-
 * managed — no delete.
 */
export function ClientGallery({ media }: { media: ClientMediaItem[] }) {
  const t = useTranslations("bookings")

  if (!media.length) {
    return (
      <EmptyState title={t("galleryEmptyTitle")} body={t("galleryEmptyBody")} />
    )
  }

  const yours = media.filter((m) => m.source === "client")
  const studio = media.filter((m) => m.source === "owner")

  const deleteLabels = {
    title: t("deleteTitle"),
    body: t("deleteBody"),
    confirm: t("deleteConfirm"),
    confirming: t("deleteConfirming"),
    cancel: t("deleteCancel"),
    failed: t("loadError"),
  }
  const shareCell = (
    label: string,
    purpose: MediaPurpose,
    status: ConsentStatus,
    mediaId: string,
  ) =>
    status === "granted" ? (
      <span className="inline-flex flex-wrap items-center gap-2">
        <Badge variant="success" size="xs">
          {label}: {t("shareShared")}
        </Badge>
        <ConfirmActionButton
          action={() => withdrawMediaConsent(mediaId, purpose)}
          labels={{
            title: purpose === "site" ? t("withdrawSiteTitle") : t("withdrawSomeTitle"),
            body: purpose === "site" ? t("withdrawSiteBody") : t("withdrawSomeBody"),
            confirm: t("withdrawConfirm"),
            confirming: t("withdrawConfirming"),
            cancel: t("deleteCancel"),
            failed: t("loadError"),
          }}
          trigger={
            <button type="button" className={withdrawPill}>
              {purpose === "site"
                ? t("removeFromWebsite")
                : t("removeFromSocial")}
            </button>
          }
        />
      </span>
    ) : (
      <Badge variant="outline" size="xs">
        {label}: {t("sharePrivate")}
      </Badge>
    )

  const renderItem = (item: ClientMediaItem) => (
    <li key={item.id} className="mb-4 break-inside-avoid space-y-2">
      <div className="relative">
        {item.kind === "video" ? (
          <video
            src={item.url}
            controls
            preload="metadata"
            className="w-full rounded-sm border border-border"
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={item.url}
            alt={item.caption ?? "Photo"}
            className="w-full rounded-sm border border-border"
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
      <div className="flex flex-col gap-1">
        {shareCell(t("shareWebsite"), "site", item.site, item.id)}
        {shareCell(t("shareSocial"), "some", item.some, item.id)}
      </div>
    </li>
  )

  const grid = (items: ClientMediaItem[]) => (
    <ul className="columns-2 gap-4 sm:columns-3">{items.map(renderItem)}</ul>
  )

  return (
    <div className="space-y-8">
      {yours.length ? (
        <section className="space-y-3">
          <Eyebrow as="h3">{t("galleryYours")}</Eyebrow>
          {grid(yours)}
        </section>
      ) : null}
      {studio.length ? (
        <section className="space-y-3">
          <Eyebrow as="h3">{t("galleryFromStudio")}</Eyebrow>
          {grid(studio)}
        </section>
      ) : null}
    </div>
  )
}
