import Image from "next/image"
import { getLocale, getTranslations } from "next-intl/server"

import { Container, Section } from "@/components/layout/container"
import { ArrowLink } from "@/components/ui/arrow-link"
import { SectionHeading } from "@/components/ui/section-heading"
import { getGalleryPreviewItems } from "@/modules/media/gallery-preview"
import { pickLocalized } from "@/shared/localized"
import { routes } from "@/config/routes"

function GalleryTile({
  src,
  alt,
  className,
  imageClassName,
  sizes,
  priority = false,
}: {
  src: string
  alt: string
  className: string
  imageClassName?: string
  sizes: string
  priority?: boolean
}) {
  return (
    <div className={className}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className={imageClassName ?? "object-cover"}
      />
    </div>
  )
}

/**
 * StudioGallery — "The Studio". A large lead image with supporting gallery
 * tiles. Responsive on mobile and powered by `gallery_items`.
 */
export async function StudioGallery() {
  const [t, locale, items] = await Promise.all([
    getTranslations("studio"),
    getLocale(),
    getGalleryPreviewItems(),
  ])

  if (!items.length) {
    return null
  }

  const leadItem = items[0]
  const supportingItems = items.slice(1)

  const getAlt = (item: (typeof items)[number], index: number) =>
    pickLocalized(locale, item.title_en, item.title_dk) ??
    `Bella Nails gallery image ${index + 1}`

  return (
    <Section className="border-t border-border">
      <Container className="max-w-4xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow={t("eyebrow")}
            lead={t("headingLead")}
            accent={t("headingAccent")}
            accentTone="secondary"
          />
          <ArrowLink href={routes.gallery}>{t("viewGallery")}</ArrowLink>
        </div>

        {supportingItems.length ? (
          <div className="grid gap-2 md:grid-cols-2">
            <GalleryTile
              src={leadItem.asset_url}
              alt={getAlt(leadItem, 0)}
              priority
              sizes="(min-width: 768px) 38vw, 100vw"
              className="relative aspect-[4/3] overflow-hidden bg-muted md:aspect-square"
              imageClassName="object-cover object-center"
            />
            <div className="grid grid-cols-2 gap-2">
              {supportingItems.map((item, index) => (
                <GalleryTile
                  key={item.id}
                  src={item.asset_url}
                  alt={getAlt(item, index + 1)}
                  sizes="(min-width: 768px) 19vw, 50vw"
                  className="relative aspect-square overflow-hidden bg-muted"
                  imageClassName="object-cover object-center"
                />
              ))}
            </div>
          </div>
        ) : (
          <GalleryTile
            src={leadItem.asset_url}
            alt={getAlt(leadItem, 0)}
            priority
            sizes="(min-width: 768px) 76vw, 100vw"
            className="relative aspect-[4/3] overflow-hidden bg-muted md:aspect-[3/2]"
            imageClassName="object-cover object-center"
          />
        )}
      </Container>
    </Section>
  )
}
