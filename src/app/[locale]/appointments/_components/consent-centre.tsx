"use client"

import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { TintedCard } from "@/components/ui/tinted-card"
import { Eyebrow, BodySm } from "@/components/ui/typography"
import {
  ConfirmActionButton,
  restoreLink,
  withdrawPill,
} from "@/components/ui/confirm-action-button"
import { useActionRunner } from "@/hooks/use-action-runner"
import type { DataConsentItem } from "@/modules/media/client-gallery"
import {
  decideDataConsent,
  withdrawDataConsent,
} from "@/modules/media/consent-actions"
import {
  DATA_CONSENT_PURPOSES,
  type DataConsentPurpose,
} from "@/shared/data-consent"

/**
 * Your name and your words — the studio's requests to use them, and what you
 * have already answered. (Media from an appointment is a booking-level RELEASE,
 * decided per appointment — see the cards above.)
 *
 * Every purpose the studio has asked about stays listed whatever the answer, in
 * one fixed order: a decline that erases its own row leaves nothing to change
 * your mind with, and the table is read without an ORDER BY, so the rows moved
 * around every time one was answered.
 */
export function ConsentCentre({
  dataConsents,
}: {
  dataConsents: DataConsentItem[]
}) {
  const t = useTranslations("bookings")
  const { pending, run: act } = useActionRunner(t("actionError"))

  // Localized prompt for a data-use request. Literal keys keep it type-safe.
  const dataPrompt = (purpose: DataConsentPurpose) => {
    switch (purpose) {
      case "name_site":
        return t("useNameSite")
      case "name_some":
        return t("useNameSome")
      case "testimonial_site":
        return t("useTestimonialSite")
      case "testimonial_some":
        return t("useTestimonialSome")
    }
  }

  const byPurpose = new Map(dataConsents.map((c) => [c.purpose, c.status]))
  // Only what the studio has actually asked about: unlike a media release, the
  // client has nothing to offer here on their own initiative.
  const asked = DATA_CONSENT_PURPOSES.filter((purpose) =>
    byPurpose.has(purpose),
  )

  if (!asked.length) {
    return null
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <Eyebrow>{t("permsEyebrow")}</Eyebrow>
        <BodySm className="max-w-prose text-xs">{t("permsIntro")}</BodySm>
      </div>

      <div className="space-y-3">
        {asked.map((purpose) => {
          const status = byPurpose.get(purpose)

          return (
            <TintedCard
              key={purpose}
              className="flex flex-wrap items-center gap-4 p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-functional text-sm text-foreground">
                  {dataPrompt(purpose)}
                </p>
                {status === "granted" ? (
                  <p className="font-functional text-xs text-success">
                    {t("dataAllowed")}
                  </p>
                ) : status !== "requested" ? (
                  <p className="font-functional text-xs text-muted-foreground">
                    {t("dataNotAllowed")}
                  </p>
                ) : null}
              </div>

              {status === "granted" ? (
                <ConfirmActionButton
                  action={() => withdrawDataConsent(purpose)}
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
              ) : status === "requested" ? (
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      act(() => decideDataConsent(purpose, "declined"))
                    }
                  >
                    {t("consentDecline")}
                  </Button>
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      act(() => decideDataConsent(purpose, "granted"))
                    }
                  >
                    {t("consentAllow")}
                  </Button>
                </div>
              ) : (
                /* Said no, or withdrew. Same rule as the release cards: only a
                   permission that was once given is given "again". */
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    act(() => decideDataConsent(purpose, "granted"))
                  }
                  className={restoreLink}
                >
                  {status === "withdrawn"
                    ? t("consentAllowAgain")
                    : t("consentAllow")}
                </button>
              )}
            </TintedCard>
          )
        })}
      </div>
    </section>
  )
}
