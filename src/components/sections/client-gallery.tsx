import { EmptyState } from "@/components/ui/empty-state"
import type { ClientMediaItem } from "@/lib/media"

/**
 * Read-only grid of a client's images/videos — the /bookings Gallery tab and
 * the admin client Gallery tab both render it. Locale-agnostic (labels passed
 * in) so it works in the admin shell, which has no next-intl context. Managing
 * consent lives in Requests, not here.
 */
export function ClientGallery({
  media,
  emptyTitle,
  emptyBody,
}: {
  media: ClientMediaItem[]
  emptyTitle: string
  emptyBody: string
}) {
  if (!media.length) {
    return <EmptyState title={emptyTitle} body={emptyBody} />
  }
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {media.map((item) => (
        <li
          key={item.id}
          className="overflow-hidden rounded-sm border border-border"
        >
          {item.kind === "video" ? (
            <video
              src={item.url}
              controls
              preload="metadata"
              className="aspect-square w-full object-cover"
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={item.url}
              alt={item.caption ?? "Photo"}
              className="aspect-square w-full object-cover"
            />
          )}
        </li>
      ))}
    </ul>
  )
}
