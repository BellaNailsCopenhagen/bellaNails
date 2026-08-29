"use client"

import { useLocale } from "next-intl"

import { Button } from "@/components/ui/button"
import { TintedCard } from "@/components/ui/tinted-card"
import { Eyebrow, BodySm } from "@/components/ui/typography"
import {
  ConfirmActionButton,
  withdrawPill,
} from "@/components/ui/confirm-action-button"
import { useActionRunner } from "@/hooks/use-action-runner"
import {
  decideMediaRelease,
  withdrawMediaRelease,
} from "@/modules/media/release-actions"
import {
  pickReleaseCopy,
  type ReleasePurpose,
  type ReleaseRequestCard,
} from "@/shared/media-release"
import { formatStudioDate } from "@/shared/studio-time"

/**
 * The client's booking-level media releases on /appointments. One card per
 * appointment: each purpose (website / social / education) is Allow / No when
 * pending, or Shared + withdraw once granted. Media use is granted per booking,
 * not per photo — the artist then publishes the shots they choose within it.
 */
export function MediaReleaseCards({ cards }: { cards: ReleaseRequestCard[] }) {
  const locale = useLocale()
  const isEn = locale === "en"
  const copy = pickReleaseCopy(locale)
  const failed = isEn ? "Something went wrong." : "Noget gik galt."
  const { pending, run } = useActionRunner(failed)

  if (!cards.length) return null

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <Eyebrow>{copy.ui.sectionTitle}</Eyebrow>
        <BodySm className="text-xs">{copy.ui.sectionIntro}</BodySm>
      </div>

      <div className="space-y-3">
        {cards.map((card) => {
          const serviceName =
            (isEn
              ? card.serviceNameEn
              : (card.serviceNameDk ?? card.serviceNameEn)) ??
            (isEn ? "Appointment" : "Tid")
          const when = card.startIso ? formatStudioDate(card.startIso, locale) : ""
          return (
            <TintedCard key={card.bookingId} className="space-y-3 p-4">
              <div>
                <p className="font-functional text-sm text-foreground">
                  {serviceName}
                </p>
                <p className="font-functional text-xs text-muted-foreground">
                  {when} · #{card.ref}
                </p>
              </div>

              {card.purposes.map(({ purpose, status }) => (
                <div
                  key={purpose}
                  className="flex items-center justify-between gap-3 border-t border-border pt-3"
                >
                  <div className="min-w-0">
                    <p className="font-functional text-sm text-foreground">
                      {copy.purposes[purpose as ReleasePurpose].label}
                    </p>
                    <p className="font-functional text-xs text-muted-foreground">
                      {copy.purposes[purpose as ReleasePurpose].description}
                    </p>
                  </div>

                  {status === "requested" ? (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          run(() =>
                            decideMediaRelease(
                              card.bookingId,
                              purpose as ReleasePurpose,
                              "declined",
                            ),
                          )
                        }
                      >
                        {copy.ui.decline}
                      </Button>
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          run(() =>
                            decideMediaRelease(
                              card.bookingId,
                              purpose as ReleasePurpose,
                              "granted",
                            ),
                          )
                        }
                      >
                        {copy.ui.allow}
                      </Button>
                    </div>
                  ) : status === "granted" ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-functional text-xs text-success">
                        {copy.ui.shared}
                      </span>
                      <ConfirmActionButton
                        action={() =>
                          withdrawMediaRelease(
                            card.bookingId,
                            purpose as ReleasePurpose,
                          )
                        }
                        labels={{ ...copy.ui.retract, failed }}
                        trigger={
                          <button type="button" className={withdrawPill}>
                            {copy.ui.stopSharing}
                          </button>
                        }
                      />
                    </div>
                  ) : (
                    <span className="shrink-0 font-functional text-xs text-muted-foreground">
                      {copy.declined}
                    </span>
                  )}
                </div>
              ))}
            </TintedCard>
          )
        })}
      </div>
    </section>
  )
}
