"use client"

import { useLocale } from "next-intl"

import { Button } from "@/components/ui/button"
import { TintedCard } from "@/components/ui/tinted-card"
import { Eyebrow, BodySm } from "@/components/ui/typography"
import {
  ConfirmActionButton,
  restoreLink,
  withdrawPill,
} from "@/components/ui/confirm-action-button"
import { useActionRunner } from "@/hooks/use-action-runner"
import {
  decideMediaRelease,
  offerMediaRelease,
  restoreMediaRelease,
  withdrawMediaRelease,
} from "@/modules/media/release-actions"
import {
  pickReleaseCopy,
  isRegrant,
  type ReleasePurpose,
  type ReleaseRequestCard,
  type ReleaseState,
} from "@/shared/media-release"
import { formatStudioDate } from "@/shared/studio-time"

/**
 * What the studio may show, appointment by appointment. One card per past
 * appointment — asked about or not — and inside it every purpose, always, in the
 * same order.
 *
 * Nothing here appears or disappears as decisions are made: only the control on
 * the right changes. The list used to be built from the stored rows, so a
 * purpose nobody had asked about was simply missing and answering one item
 * reshuffled the rest under the client's finger. Permission is granted per
 * appointment, not per photo — the artist then publishes the shots she chooses
 * within it.
 */
export function MediaReleaseCards({
  cards,
  mediaCountByBooking,
}: {
  cards: ReleaseRequestCard[]
  /** How many photos/videos the studio has from each appointment. */
  mediaCountByBooking: Record<string, number>
}) {
  const locale = useLocale()
  const isEn = locale === "en"
  const copy = pickReleaseCopy(locale)
  const failed = isEn ? "Something went wrong." : "Noget gik galt."
  const { pending, run } = useActionRunner(failed)

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <Eyebrow>{copy.ui.sectionTitle}</Eyebrow>
        <BodySm className="max-w-prose text-xs">{copy.ui.sectionIntro}</BodySm>
      </div>

      {cards.length === 0 ? (
        <BodySm className="text-xs text-muted-foreground">
          {copy.ui.noAppointments}
        </BodySm>
      ) : (
        <div className="space-y-3">
          {cards.map((card) => {
            const serviceName =
              (isEn
                ? card.serviceNameEn
                : (card.serviceNameDk ?? card.serviceNameEn)) ??
              (isEn ? "Appointment" : "Tid")
            const when = card.startIso
              ? formatStudioDate(card.startIso, locale)
              : ""
            return (
              <TintedCard key={card.bookingId} className="space-y-3 p-4">
                <div>
                  <p className="font-functional text-sm text-foreground">
                    {serviceName}
                  </p>
                  <p className="font-functional text-xs text-muted-foreground">
                    {when} · #{card.ref}
                  </p>
                  {mediaCountByBooking[card.bookingId] ? null : (
                    <p className="mt-1 font-functional text-xs text-muted-foreground/80">
                      {copy.ui.noMediaYet}
                    </p>
                  )}
                </div>

                {card.purposes.map(({ purpose, status }) => (
                  <div
                    key={purpose}
                    className="flex flex-wrap items-start justify-between gap-3 border-t border-border pt-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-functional text-sm text-foreground">
                        {copy.purposes[purpose].label}
                      </p>
                      <p className="font-functional text-xs text-muted-foreground">
                        {copy.purposes[purpose].description}
                      </p>
                    </div>

                    <PurposeControl
                      bookingId={card.bookingId}
                      purpose={purpose}
                      status={status}
                      copy={copy.ui}
                      failed={failed}
                      pending={pending}
                      run={run}
                    />
                  </div>
                ))}
              </TintedCard>
            )
          })}
        </div>
      )}
    </section>
  )
}

type ReleaseUiCopy = ReturnType<typeof pickReleaseCopy>["ui"]
type RunAction = ReturnType<typeof useActionRunner>["run"]

/** The right-hand half of one purpose row — the only part a decision changes. */
function PurposeControl({
  bookingId,
  purpose,
  status,
  copy,
  failed,
  pending,
  run,
}: {
  bookingId: string
  purpose: ReleasePurpose
  status: ReleaseState
  copy: ReleaseUiCopy
  failed: string
  pending: boolean
  run: RunAction
}) {
  if (status === "requested") {
    return (
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="font-functional text-xs text-muted-foreground">
          {copy.awaiting}
        </span>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => run(() => decideMediaRelease(bookingId, purpose, "declined"))}
          >
            {copy.decline}
          </Button>
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run(() => decideMediaRelease(bookingId, purpose, "granted"))}
          >
            {copy.allow}
          </Button>
        </div>
      </div>
    )
  }

  if (status === "granted") {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-functional text-xs text-success">
          {copy.shared}
        </span>
        <ConfirmActionButton
          action={() => withdrawMediaRelease(bookingId, purpose)}
          labels={{ ...copy.retract, failed }}
          trigger={
            <button type="button" className={withdrawPill}>
              {copy.stopSharing}
            </button>
          }
        />
      </div>
    )
  }

  /* Never asked, said no, or later withdrew — all three offer the same way in.
     A control that is easy to leave and hard to return to makes people avoid
     leaving in the first place, so the way back sits right here. Only a
     permission that was actually GIVEN can be given "again"; a first ask and a
     decline both read plainly as "allow". Restoring does NOT republish:
     withdrawal deleted the public copy, so the studio places it again if it
     still wants to. */
  return (
    <div className="flex shrink-0 items-center gap-3">
      <span className="font-functional text-xs text-muted-foreground">
        {copy.notShared}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          run(() =>
            status === "none"
              ? offerMediaRelease(bookingId, purpose)
              : restoreMediaRelease(bookingId, purpose),
          )
        }
        className={restoreLink}
      >
        {isRegrant(status) ? copy.allowAgain : copy.allow}
      </button>
    </div>
  )
}
