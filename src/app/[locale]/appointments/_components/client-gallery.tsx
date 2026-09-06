"use client"

import { useLocale, useTranslations } from "next-intl"

import { Eyebrow } from "@/components/ui/typography"
import { EmptyState } from "@/components/ui/empty-state"
import { ClientGalleryTile } from "@/app/[locale]/appointments/_components/client-gallery-tile"
import type { ClientMediaItem } from "@/modules/media/client-gallery"

/**
 * The client's Gallery tab. A masonry of natural-ratio thumbnails; tapping one
 * opens a full-size view with the share state (website / social) and a way
 * through to that appointment's permission card, where it can be taken back.
 * The photos are the studio's own, so there is nothing here to delete.
 */
export function ClientGallery({
  media,
  permissionBookingIds,
}: {
  media: ClientMediaItem[]
  /** Appointments that actually have a permission card to be sent to. */
  permissionBookingIds: string[]
}) {
  const t = useTranslations("bookings")
  const locale = useLocale()
  const hasCard = new Set(permissionBookingIds)

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
          <ClientGalleryTile
            key={item.id}
            item={item}
            locale={locale}
            canManagePermission={
              item.bookingId ? hasCard.has(item.bookingId) : false
            }
          />
        ))}
      </ul>
    </section>
  )
}
