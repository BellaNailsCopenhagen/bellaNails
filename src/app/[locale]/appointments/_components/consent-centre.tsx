"use client"

import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { TintedCard } from "@/components/ui/tinted-card"
import { Eyebrow, BodySm } from "@/components/ui/typography"
import {
  ConfirmActionButton,
  withdrawPill,
} from "@/components/ui/confirm-action-button"
import { useActionRunner } from "@/hooks/use-action-runner"
import type { DataConsentItem } from "@/modules/media/client-gallery"
import {
  decideDataConsent,
  withdrawDataConsent,
} from "@/modules/media/consent-actions"

/**
 * The client's data-consent centre on /appointments — the studio's requests to
 * use their name / testimonial, with Allow / No and a withdraw once granted.
 * (Media use is now a booking-level RELEASE, approved per appointment — see the
 * release cards.) The client is always in control; declines stay per-item.
 */
export function ConsentCentre({
  dataConsents,
}: {
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

  const dataRequests = dataConsents.filter(
    (c) => c.status === "requested" || c.status === "granted",
  )

  if (!dataRequests.length) return null

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <Eyebrow>{t("permsEyebrow")}</Eyebrow>
        <BodySm className="text-xs">{t("permsIntro")}</BodySm>
      </div>

      <div className="space-y-3">
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
