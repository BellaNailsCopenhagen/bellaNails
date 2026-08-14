"use client"

import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { TintedCard } from "@/components/ui/tinted-card"
import { Eyebrow, BodySm } from "@/components/ui/typography"
import {
  ConfirmActionButton,
  withdrawPill,
} from "@/components/sections/confirm-action-button"
import { useActionRunner } from "@/lib/hooks/use-action-runner"
import type {
  ClientMediaItem,
  DataConsentItem,
  MediaPurpose,
} from "@/lib/media"
import {
  acceptAllPendingConsents,
  decideDataConsent,
  decideMediaConsent,
  withdrawDataConsent,
} from "@/lib/actions/client-consent"

type MediaRequest = { media: ClientMediaItem; purpose: MediaPurpose }

/**
 * The client's consent centre on /appointments — every request the studio has
 * made to publish a photo or use their data, with Allow / No, plus an
 * accept-all for the whole list. The client is always in control; nothing is
 * published without an explicit grant, and declines stay per-item.
 */
export function ConsentCentre({
  media,
  dataConsents,
}: {
  media: ClientMediaItem[]
  dataConsents: DataConsentItem[]
}) {
  const t = useTranslations("bookings")
  const { pending, run: act } = useActionRunner(t("actionError"))

  // Localized prompt for a data-use request. Literal keys keep it type-safe;
  // an unknown purpose falls back to its raw value rather than throwing.
  const dataPrompt = (purpose: string) => {
    switch (purpose) {
      case "name_site":
        return t("useNameSite")
      case "name_some":
        return t("useNameSome")
      case "testimonial_site":
        return t("useTestimonialSite")
      case "testimonial_some":
        return t("useTestimonialSome")
      default:
        return purpose
    }
  }

  // Only photos still AWAITING a decision live here — once granted, the client
  // manages sharing from the photo itself in the Gallery (a quieter, more
  // considered place for withdrawal). Requests stays a clean to-decide inbox.
  const requests: MediaRequest[] = []
  for (const item of media) {
    for (const purpose of ["site", "some"] as MediaPurpose[]) {
      if (item[purpose] === "requested") {
        requests.push({ media: item, purpose })
      }
    }
  }
  const dataRequests = dataConsents.filter(
    (c) => c.status === "requested" || c.status === "granted",
  )

  if (!requests.length && !dataRequests.length) return null

  // Accept-all covers PHOTOS only (data/testimonial consent stays per-item) —
  // show it only when there are 2+ pending photo requests to speed through.
  const pendingPhotoCount = requests.length

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Eyebrow>{t("permsEyebrow")}</Eyebrow>
          <BodySm className="text-xs">{t("permsIntro")}</BodySm>
        </div>
        {pendingPhotoCount >= 2 ? (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            className="shrink-0"
            onClick={() => act(() => acceptAllPendingConsents())}
          >
            {t("acceptAllPhotos")}
          </Button>
        ) : null}
      </div>

      <div className="space-y-3">
        {requests.map(({ media: item, purpose }) => (
          <TintedCard
            key={`${item.id}-${purpose}`}
            className="flex items-center gap-4 p-4"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.url}
              alt={t("photoAlt")}
              className="size-16 shrink-0 rounded-sm border border-border object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="font-functional text-sm text-foreground">
                {t(purpose === "site" ? "sharePromptSite" : "sharePromptSome")}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() =>
                  act(() => decideMediaConsent(item.id, purpose, "declined"))
                }
              >
                {t("consentDecline")}
              </Button>
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  act(() => decideMediaConsent(item.id, purpose, "granted"))
                }
              >
                {t("consentAllow")}
              </Button>
            </div>
          </TintedCard>
        ))}

        {dataRequests.map((consent) => (
          <TintedCard
            key={consent.purpose}
            className="flex items-center gap-4 p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="font-functional text-sm text-foreground">
                {dataPrompt(consent.purpose)}
              </p>
              {consent.status === "granted" ? (
                <p className="font-functional text-xs text-success">
                  {t("dataAllowed")}
                </p>
              ) : null}
            </div>
            {consent.status === "granted" ? (
              <ConfirmActionButton
                action={() =>
                  withdrawDataConsent(
                    consent.purpose as Parameters<typeof withdrawDataConsent>[0],
                  )
                }
                labels={{
                  title: t("withdrawDataTitle"),
                  body: t("withdrawDataBody"),
                  confirm: t("withdrawConfirm"),
                  confirming: t("withdrawConfirming"),
                  cancel: t("deleteCancel"),
                  failed: t("loadError"),
                }}
                trigger={
                  <button type="button" className={withdrawPill}>
                    {t("stopUsingCta")}
                  </button>
                }
              />
            ) : (
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    act(() =>
                      decideDataConsent(
                        consent.purpose as Parameters<typeof decideDataConsent>[0],
                        "declined",
                      ),
                    )
                  }
                >
                  {t("consentDecline")}
                </Button>
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    act(() =>
                      decideDataConsent(
                        consent.purpose as Parameters<typeof decideDataConsent>[0],
                        "granted",
                      ),
                    )
                  }
                >
                  {t("consentAllow")}
                </Button>
              </div>
            )}
          </TintedCard>
        ))}
      </div>
    </section>
  )
}
