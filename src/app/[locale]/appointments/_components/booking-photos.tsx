import { getTranslations } from "next-intl/server"

import { ArrowLink } from "@/components/ui/arrow-link"
import { BodySm } from "@/components/ui/typography"
import type { ClientMediaItem } from "@/modules/media/client-gallery"
import { routes } from "@/config/routes"

/**
 * A past appointment's photos, plus the way to raise something about it.
 *
 * This used to be a client UPLOAD ("share your set"), aimed at feeding the
 * public gallery. That pipeline is retired — the gallery runs on the artist's
 * own photos — so the slot now does the job a client actually needs here: if a
 * set has lifted or chipped, it opens a repair request with the appointment's
 * context attached, which the artist answers with a one-time offer.
 *
 * The photos shown are the artist's, from this appointment; publishing any of
 * them still needs the separate media release.
 */
export async function BookingPhotos({
  bookingId,
  photos,
}: {
  bookingId: string
  photos: ClientMediaItem[]
}) {
  const t = await getTranslations("bookings")

  return (
    <div className="space-y-3">
      {photos.length ? (
        <ul className="flex flex-wrap gap-2">
          {photos.map((photo) => (
            <li key={photo.id}>
              {/* Private object behind a short-lived signed URL. The artist may
                  attach a short clip as well as stills, so honour the kind. */}
              {photo.kind === "video" ? (
                <video
                  src={photo.url}
                  preload="metadata"
                  className="size-16 rounded-sm border border-border object-cover"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={photo.url}
                  alt={t("photoAlt")}
                  className="size-16 rounded-sm border border-border object-cover"
                />
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <ArrowLink
        href={{
          pathname: routes.ask,
          query: { topic: "repair", booking: bookingId },
        }}
      >
        {t("somethingWrong")}
      </ArrowLink>
      <BodySm className="text-xs text-muted-foreground">
        {t("somethingWrongBody")}
      </BodySm>
    </div>
  )
}
