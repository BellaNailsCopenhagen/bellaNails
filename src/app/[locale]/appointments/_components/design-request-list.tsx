import { getLocale, getTranslations } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { DesignReplyForm } from "@/app/[locale]/appointments/_components/design-reply-form"
import { DesignThreadsSeen } from "@/app/[locale]/appointments/_components/design-threads-seen"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TintedCard } from "@/components/ui/tinted-card"
import { BodySm, Eyebrow } from "@/components/ui/typography"
import type { DesignRequestView } from "@/modules/design"
import { isActionableDesignStatus, type DesignStatus } from "@/shared/design"
import { offerPath, routes } from "@/config/routes"
import { formatPrice } from "@/shared/money"
import { formatStudioDayMonthYear } from "@/shared/studio-time"
import { pickLocalized } from "@/shared/localized"

/**
 * The client's side of their conversations with the artist — one card per
 * thread, the way the artist's queue is one card per thread. The card is
 * ordered by what the client has to DO with it: the live offer first (it is the
 * only thing here with a deadline), then the conversation, then the reply box.
 *
 * Server-rendered; the offer link is the same signed token as the email, so one
 * route serves both entry points.
 */

/**
 * What the CLIENT should be told. The stored status only moves when the artist
 * opens her queue, so a lapsed offer would otherwise still read "Offer ready"
 * with nothing to click. The offer's own state is live, so it wins.
 */
function displayStatus(request: DesignRequestView): DesignStatus {
  const state = request.offer?.state
  if (request.status === "offered" && state && state !== "live") {
    return state === "used" ? "booked" : "expired"
  }
  return request.status
}

const STATUS_VARIANT: Record<DesignStatus, "outline" | "success" | "warning"> = {
  open: "outline",
  offered: "warning",
  booked: "success",
  declined: "outline",
  expired: "outline",
}

/** The newest studio answer across the rendered threads, or null if there is
    nothing to mark read. */
function newestAnswer(requests: DesignRequestView[]): string | null {
  return requests.reduce<string | null>((newest, request) => {
    const at = request.lastArtistReplyAt
    if (!at) return newest
    return !newest || Date.parse(at) > Date.parse(newest) ? at : newest
  }, null)
}

export async function DesignRequestList({
  requests,
  offerTokens,
}: {
  requests: DesignRequestView[]
  /** offerId → signed token, minted server-side. */
  offerTokens: Record<string, string>
}) {
  const [t, locale] = await Promise.all([
    getTranslations("designRequests"),
    getLocale(),
  ])

  if (!requests.length) {
    return (
      <div className="space-y-4">
        <BodySm>{t("empty")}</BodySm>
        <Button nativeButton={false} render={<Link href={routes.ask} />}>
          {t("askCta")}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Reading the panel IS opening the messages, so the marker goes here
          rather than behind a second tap. It carries the newest answer ON THIS
          render — anything later hasn't been seen. */}
      <DesignThreadsSeen seenAt={newestAnswer(requests)} />

      {/* Above the threads, not below them: starting a new one is why a client
          opens this tab, and a client with a long history had to scroll past
          every past conversation to find the way to begin another. */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <Eyebrow>{t("sectionTitle")}</Eyebrow>
          <BodySm className="text-xs text-muted-foreground">
            {t("sectionIntro")}
          </BodySm>
        </div>
        <Button
          size="sm"
          nativeButton={false}
          render={<Link href={routes.ask} />}
        >
          {t("askCta")}
        </Button>
      </div>

      <ul className="space-y-4">
        {requests.map((request) => {
          const offer = request.offer
          const token = offer ? offerTokens[offer.id] : undefined
          // One status drives the whole card. Reading the raw column here let a
          // card say "Offer expired" while still showing an open reply box.
          const shown = displayStatus(request)
          // The badge reads the offer's real state; whether the thread still
          // TAKES input is the stored status — a lapsed offer leaves the
          // conversation open, and `addDesignMessage` checks the same column.
          const open = isActionableDesignStatus(request.status)
          const offerName = offer
            ? (pickLocalized(locale, offer.nameEn, offer.nameDk) ?? offer.nameEn)
            : null
          const liveOffer = offer?.state === "live" && offerName && token

          return (
            <TintedCard as="li" key={request.id} className="space-y-5 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" size="xs">
                    {t(`topic.${request.topic}`)}
                  </Badge>
                  <Badge variant={STATUS_VARIANT[shown]} size="xs">
                    {t(`status.${shown}`)}
                  </Badge>
                  {request.hasUnreadReply ? (
                    <Badge variant="warning" size="xs">
                      {t("newReply")}
                    </Badge>
                  ) : null}
                </div>
                <BodySm className="text-xs text-muted-foreground">
                  {t("asked", {
                    date: formatStudioDayMonthYear(
                      Date.parse(request.createdAt),
                      locale,
                    ),
                  })}
                </BodySm>
              </div>

              {/* The offer is the only thing on this card with a deadline, so it
                  sits above the conversation and owns the primary button. */}
              {liveOffer ? (
                <div className="space-y-3 rounded-md border border-foreground/20 bg-background/60 p-4">
                  <Eyebrow>{t("offerHeading")}</Eyebrow>
                  <div className="space-y-1">
                    <BodySm className="text-base text-foreground">
                      {offerName}
                    </BodySm>
                    <BodySm className="text-xs text-muted-foreground">
                      {t("offerSummary", {
                        mins: offer.durationMins,
                        price: formatPrice(offer.priceCents, locale),
                      })}
                    </BodySm>
                    <BodySm className="text-xs text-muted-foreground">
                      {t("offerHolds", {
                        date: formatStudioDayMonthYear(
                          Date.parse(offer.expiresAt),
                          locale,
                        ),
                      })}
                    </BodySm>
                  </div>
                  <Button
                    size="sm"
                    nativeButton={false}
                    render={<Link href={offerPath(token)} />}
                  >
                    {t("viewOffer")}
                  </Button>
                </div>
              ) : null}

              <div className="space-y-3">
                <Eyebrow as="h3">{t("threadHeading")}</Eyebrow>
                <ul className="space-y-3">
                  {request.messages.map((message) => (
                    <li key={message.id} className="text-sm">
                      <span className="font-functional text-xs uppercase tracking-widest-lux text-muted-foreground">
                        {message.author === "artist"
                          ? t("authorArtist")
                          : t("authorClient")}
                      </span>
                      <p className="mt-0.5 whitespace-pre-wrap text-foreground">
                        {message.body}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>

              {request.refs.length ? (
                <div className="space-y-2">
                  <Eyebrow as="h3">{t("photosHeading")}</Eyebrow>
                  <ul className="flex flex-wrap gap-2">
                    {request.refs.map((ref) => (
                      <li key={ref.id}>
                        {/* Private object behind a short-lived signed URL. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={ref.url}
                          alt={t("photoAlt")}
                          className="size-16 rounded-sm border border-border object-cover"
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Still on the studio's plate → they can add to it. A closed thread stays
                  readable but takes no more input; a new ask starts fresh. */}
              {open ? (
                <DesignReplyForm
                  requestId={request.id}
                  refCount={request.refCount}
                />
              ) : (
                <BodySm className="text-xs text-muted-foreground">
                  {t("closedNote")}
                </BodySm>
              )}
            </TintedCard>
          )
        })}
      </ul>

      <Button
        variant="outline"
        nativeButton={false}
        render={<Link href={routes.ask} />}
      >
        {t("askCta")}
      </Button>
    </div>
  )
}
