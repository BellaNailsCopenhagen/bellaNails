import { getLocale, getTranslations } from "next-intl/server"

import { Link } from "@/i18n/navigation"
import { ArrowLink } from "@/components/ui/arrow-link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BodySm, Eyebrow } from "@/components/ui/typography"
import type { DesignRequestView } from "@/modules/design"
import type { DesignStatus } from "@/shared/design"
import { offerPath, routes } from "@/config/routes"
import { formatPrice } from "@/shared/money"
import { pickLocalized } from "@/shared/localized"

/**
 * The client's side of their conversations with the artist: what they asked,
 * what she said, and — when there's a live offer — the way through to booking
 * it. Server-rendered; the offer link is the same signed token as the email, so
 * one route serves both entry points.
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
      <div className="space-y-1">
        <Eyebrow>{t("sectionTitle")}</Eyebrow>
        <BodySm className="text-xs text-muted-foreground">
          {t("sectionIntro")}
        </BodySm>
      </div>

      <ul className="space-y-6">
        {requests.map((request) => {
          const offer = request.offer
          const token = offer ? offerTokens[offer.id] : undefined
          const offerName = offer
            ? (pickLocalized(locale, offer.nameEn, offer.nameDk) ?? offer.nameEn)
            : null

          return (
            <li
              key={request.id}
              className="space-y-3 border-b border-border pb-6 last:border-b-0"
            >
              <Badge variant="outline" size="xs">
                {t(`status.${displayStatus(request)}`)}
              </Badge>

              <ul className="space-y-2">
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

              {request.refs.length ? (
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
              ) : null}

              {offer && offerName && offer.state === "live" && token ? (
                <div className="space-y-2 border-l-2 border-foreground pl-4">
                  <BodySm className="text-base text-foreground">{offerName}</BodySm>
                  <BodySm className="text-xs text-muted-foreground">
                    {t("offerSummary", {
                      mins: offer.durationMins,
                      price: formatPrice(offer.priceCents, locale),
                    })}
                  </BodySm>
                  <ArrowLink href={offerPath(token)}>{t("viewOffer")}</ArrowLink>
                </div>
              ) : null}
            </li>
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
