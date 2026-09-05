import { ConsentCentre } from "@/app/[locale]/appointments/_components/consent-centre"
import { MediaReleaseCards } from "@/app/[locale]/appointments/_components/media-release-cards"
import { MyTestimonials } from "@/app/[locale]/appointments/_components/my-testimonials"
import { ReleaseExplainer } from "@/app/[locale]/appointments/_components/release-explainer"
import { TestimonialInviteCard } from "@/app/[locale]/appointments/_components/testimonial-invite-card"
import type { ClientMediaItem, DataConsentItem } from "@/modules/media/client-gallery"
import type { MyTestimonial } from "@/modules/testimonials"
import type { ReleaseRequestCard } from "@/shared/media-release"

/**
 * The Permissions tab — everything the studio may show of a client, in the order
 * they will be asked about it: how it works, then each appointment's photos,
 * then their name and their words.
 *
 * Nothing here is conditional on having been asked. The panel always renders, so
 * a client who has answered everything still has somewhere to go and change
 * their mind.
 */
export function PermissionsPanel({
  permissions,
  media,
  dataConsents,
  testimonialInviteToken,
  testimonials,
}: {
  permissions: ReleaseRequestCard[]
  media: ClientMediaItem[]
  dataConsents: DataConsentItem[]
  testimonialInviteToken: string | null
  testimonials: MyTestimonial[]
}) {
  const mediaCountByBooking: Record<string, number> = {}
  for (const item of media) {
    if (!item.bookingId) continue
    mediaCountByBooking[item.bookingId] =
      (mediaCountByBooking[item.bookingId] ?? 0) + 1
  }

  return (
    <div className="space-y-10">
      <ReleaseExplainer />
      <MediaReleaseCards
        cards={permissions}
        mediaCountByBooking={mediaCountByBooking}
      />
      <ConsentCentre dataConsents={dataConsents} />
      {testimonialInviteToken ? (
        <TestimonialInviteCard token={testimonialInviteToken} />
      ) : null}
      <MyTestimonials items={testimonials} />
    </div>
  )
}
