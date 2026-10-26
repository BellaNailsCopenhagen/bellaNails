"use client"

import { Camera, Star } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useDeploymentCapabilities } from "@/components/admin/deployment-capabilities"
import { useActionRunner } from "@/hooks/use-action-runner"
import { requestReview } from "@/modules/booking/review-actions"
import { requestMediaRelease } from "@/modules/media/owner-media-actions"
import { RELEASE_PURPOSES } from "@/shared/media-release"

/**
 * Admin booking-card requests, shown from ~30 min before the appointment (media
 * is shot during/after). "Request media use" asks the client to release the
 * appointment's photos+videos for all purposes — they pick which to allow on the
 * approval page. "Request review" emails our external review link — env-gated,
 * so with no link configured it renders as an inert control saying why rather
 * than as a button identical to the ones that work.
 */
export function BookingRequestActions({
  bookingId,
  canMedia,
  mediaAlreadyRequested = false,
  canReview,
}: {
  bookingId: string
  canMedia: boolean
  /** Something's already been sent → the button re-requests ("… again"). */
  mediaAlreadyRequested?: boolean
  canReview: boolean
}) {
  const { pending, run } = useActionRunner()
  const { reviewLink } = useDeploymentCapabilities()

  return (
    <>
      {canMedia ? (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(() => requestMediaRelease(bookingId, [...RELEASE_PURPOSES]))
          }
        >
          <Camera className="size-3.5" />
          {mediaAlreadyRequested
            ? "Request media use again"
            : "Request media use"}
        </Button>
      ) : null}
      {canReview ? (
        reviewLink ? (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => run(() => requestReview(bookingId))}
          >
            <Star className="size-3.5" />
            Request review
          </Button>
        ) : (
          // Same place, same shape, obviously inert — and it says which piece
          // of setup is missing instead of erroring once per press.
          <Button variant="outline" size="sm" disabled>
            <Star className="size-3.5" />
            Review link not set up
          </Button>
        )
      ) : null}
    </>
  )
}
