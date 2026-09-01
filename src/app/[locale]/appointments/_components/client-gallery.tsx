"use client"

import { useTranslations } from "next-intl"

import { Eyebrow } from "@/components/ui/typography"
import { EmptyState } from "@/components/ui/empty-state"
import { ClientGalleryTile } from "@/app/[locale]/appointments/_components/client-gallery-tile"
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

  // One list: every photo here is the artist's, taken at the studio. Clients
  // don't upload, so the old "yours / from the studio" split had an always-empty
  // half.
  return (
    <section className="space-y-3">
      <Eyebrow as="h3">{t("galleryFromStudio")}</Eyebrow>
      <ul className="columns-2 gap-4 sm:columns-3">
        {media.map((item) => (
          <ClientGalleryTile key={item.id} item={item} />
        ))}
      </ul>
    </section>
  )
}
