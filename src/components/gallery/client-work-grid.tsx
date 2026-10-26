"use client"

import { useState } from "react"

import { PhotoLightbox } from "@/components/gallery/photo-lightbox"
import { cn } from "@/shared/cn"
import type { PublicAsset } from "@/modules/media/public-assets"

/**
 * Columns never outnumber the photos, and the cap comes down from four to three.
 * The old fixed 4-up masonry rendered a lone photo as a ~200px thumbnail, and a
 * full one at ~200px a tile — small enough to be the reason this was reported.
 * The width cap on the sparse cases keeps a single uncropped portrait from
 * filling the page. Every tile now lands between ~275px and ~380px wide.
 */
const MASONRY_BY_COUNT = [
  "columns-1 max-w-sm",
  "columns-2 max-w-2xl",
  "columns-2 sm:columns-3",
]

/**
 * A masonry of consented client photos at their real aspect ratio (client work
 * is never cropped), each opening full size on click. Presentational — the
 * surface sections fetch the assets and hand them in, so /gallery, the home
 * showcase and a service page render the same way.
 *
 * Intrinsic dimensions aren't stored yet, so tiles size to the media once it
 * loads; the muted `bg-muted` box holds the column until then. Storing width/
 * height on `assets` would let us reserve the exact ratio and remove the shift.
 */
export function ClientWorkGrid({
  assets,
  alt,
}: {
  assets: PublicAsset[]
  alt: string
}) {
  const [active, setActive] = useState<PublicAsset | null>(null)

  if (!assets.length) {
    return null
  }

  return (
    <>
      <ul
        className={cn(
          "gap-3",
          MASONRY_BY_COUNT[
            Math.min(assets.length, MASONRY_BY_COUNT.length) - 1
          ],
        )}
      >
        {assets.map((asset) => (
          <li
            key={asset.id}
            className="mb-3 break-inside-avoid overflow-hidden rounded-sm border border-border bg-muted"
          >
            {asset.mediaType === "video" ? (
              // No click-to-open: a wrapping button would swallow the controls.
              <video
                src={asset.url}
                controls
                playsInline
                preload="metadata"
                className="w-full"
              />
            ) : (
              <button
                type="button"
                onClick={() => setActive(asset)}
                className="block w-full cursor-zoom-in outline-none transition-opacity hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.url}
                  alt={alt}
                  loading="lazy"
                  decoding="async"
                  className="w-full"
                />
              </button>
            )}
          </li>
        ))}
      </ul>

      <PhotoLightbox
        src={active?.url ?? null}
        alt={alt}
        onClose={() => setActive(null)}
      />
    </>
  )
}
