"use client"

import { Camera, Star } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useActionRunner } from "@/hooks/use-action-runner"
import { requestReview } from "@/modules/booking/review-actions"
import { requestMediaRelease } from "@/modules/media/owner-media-actions"
import { RELEASE_PURPOSES } from "@/shared/media-release"

/**
 * Admin booking-card requests, shown from ~30 min before the appointment (media
 * is shot during/after). "Request media use" asks the client to release the
 * appointment's photos+videos for all purposes — they pick which to allow on the
 * approval page. "Request review" emails our external review link (env-gated).
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
  return (
    <>
      {canMedia ? (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => run(() => requestMediaRelease(bookingId, [...RELEASE_PURPOSES]))}
        >
          <Camera className="size-3.5" />
          {mediaAlreadyRequested ? "Request media use again" : "Request media use"}
        </Button>
      ) : null}
      {canReview ? (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => run(() => requestReview(bookingId))}
        >
          <Star className="size-3.5" />
          Request review
        </Button>
      ) : null}
    </>
  )
}
