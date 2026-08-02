import type { PublicAsset } from "@/lib/services/get-public-assets"

/**
 * A masonry of consented client photos at their real aspect ratio (client work
 * is never cropped). Presentational — the surface sections fetch the assets and
 * hand them in, so /gallery and the home showcase render the same way.
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
  return (
    <ul className="columns-2 gap-3 sm:columns-3 lg:columns-4">
      {assets.map((asset) => (
        <li
          key={asset.id}
          className="mb-3 break-inside-avoid overflow-hidden rounded-sm border border-border bg-muted"
        >
          {asset.mediaType === "video" ? (
            <video
              src={asset.url}
              controls
              playsInline
              preload="metadata"
              className="w-full"
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={asset.url}
              alt={alt}
              loading="lazy"
              decoding="async"
              className="w-full"
            />
          )}
        </li>
      ))}
    </ul>
  )
}
