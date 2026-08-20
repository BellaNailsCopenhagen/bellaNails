"use client"

import { useTranslations } from "next-intl"

import { Eyebrow } from "@/components/ui/typography"
import { EmptyState } from "@/components/ui/empty-state"
import { ClientGalleryTile } from "@/components/sections/client-gallery-tile"
import type { ClientMediaItem } from "@/modules/media/client-gallery"

/**
 * The client's Gallery tab, split into "Your photos" and "From Bella Nails"
 * (studio-added). A masonry of natural-ratio thumbnails; tapping one opens a
 * full-size dialog with the share state (website / social) and the withdraw +
 * delete actions. Studio photos are studio-managed — no delete.
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

  const grid = (items: ClientMediaItem[]) => (
    <ul className="columns-2 gap-4 sm:columns-3">
      {items.map((item) => (
        <ClientGalleryTile key={item.id} item={item} />
      ))}
    </ul>
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
