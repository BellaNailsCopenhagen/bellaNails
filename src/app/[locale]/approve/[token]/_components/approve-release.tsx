"use client"

import { useState } from "react"
import { useLocale } from "next-intl"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { PageHeader } from "@/components/ui/page-header"
import { TintedCard } from "@/components/ui/tinted-card"
import { BodySm, Eyebrow, H2 } from "@/components/ui/typography"
import { useActionRunner } from "@/hooks/use-action-runner"
import { respondToReleaseToken } from "@/modules/media/release-actions"
import {
  pickReleaseCopy,
  releaseErrorCopy,
  type ReleasePurpose,
  type ReleaseRequestCard,
} from "@/shared/media-release"
import { formatStudioDate } from "@/shared/studio-time"

/**
 * The public approval page's form: the appointment it covers, one checkbox per
 * pending purpose, and Save / Decline all. Granting only what's ticked; the rest
 * are recorded as declined. All wording is localized from shared/media-release so
 * a guest with no account still sees natural da/en copy.
 */
export function ApproveRelease({
  token,
  card,
}: {
  token: string
  card: ReleaseRequestCard | null
}) {
  const locale = useLocale()
  const isEn = locale === "en"
  const copy = pickReleaseCopy(locale)
  const failed = isEn ? "Something went wrong." : "Noget gik galt."
  const { pending, run } = useActionRunner(failed)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [done, setDone] = useState<null | "granted" | "declined">(null)

  if (!card) {
    return (
      <div className="space-y-3">
        <Eyebrow>{copy.heading}</Eyebrow>
        <H2>
          {isEn
            ? "This link is invalid or has expired."
            : "Linket er ugyldigt eller udløbet."}
        </H2>
      </div>
    )
  }

  const pendingPurposes = card.purposes.filter((p) => p.status === "requested")

  if (done || !pendingPurposes.length) {
    // Reflect what was actually decided — a guest who declined everything must
    // not be told their consent is saved.
    const granted =
      done === "granted" ||
      (!done && card.purposes.some((p) => p.status === "granted"))

    return (
      <div className="space-y-3">
        <Eyebrow>{copy.heading}</Eyebrow>
        <H2>{granted ? copy.granted : copy.declined}</H2>
      </div>
    )
  }

  const serviceName =
    (isEn ? card.serviceNameEn : (card.serviceNameDk ?? card.serviceNameEn)) ??
    (isEn ? "your appointment" : "din tid")
  const when = card.startIso ? formatStudioDate(card.startIso, locale) : ""
  const anyChecked = pendingPurposes.some((p) => checked[p.purpose])

  const submit = (grant: boolean) =>
    run(async () => {
      const decisions = pendingPurposes.map((p) => ({
        purpose: p.purpose as ReleasePurpose,
        decision: (grant && checked[p.purpose] ? "granted" : "declined") as
          "granted" | "declined",
      }))
      const result = await respondToReleaseToken(token, decisions)
      if (result.ok) {
        setDone(
          grant && decisions.some((d) => d.decision === "granted")
            ? "granted"
            : "declined",
        )
      }

      // The action answers with a code; saying it out loud is our job.
      return result.ok
        ? result
        : { ...result, error: releaseErrorCopy(locale, result.error) }
    })

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={copy.heading}
        lead={copy.requestTitle.lead}
        muted={copy.requestTitle.muted}
        intro={
          <>
            {copy.appointment(serviceName, when, card.ref)}
            <span className="mt-2 block text-muted-foreground">
              {copy.helper}
            </span>
          </>
        }
      />
      <BodySm>{copy.intro}</BodySm>

      <p className="font-functional text-sm font-medium text-foreground">
        {copy.choose}
      </p>

      <div className="space-y-3">
        {pendingPurposes.map(({ purpose }) => {
          const p = purpose as ReleasePurpose

          return (
            <TintedCard key={purpose} className="flex items-start gap-3 p-4">
              <Checkbox
                id={`purpose-${purpose}`}
                checked={Boolean(checked[purpose])}
                onCheckedChange={(value) =>
                  setChecked((prev) => ({ ...prev, [purpose]: value === true }))
                }
                disabled={pending}
              />
              <label
                htmlFor={`purpose-${purpose}`}
                className="min-w-0 flex-1 cursor-pointer"
              >
                <span className="block font-functional text-sm text-foreground">
                  {copy.purposes[p].label}
                </span>
                <span className="block font-functional text-xs text-muted-foreground">
                  {copy.purposes[p].description}
                </span>
              </label>
            </TintedCard>
          )
        })}
      </div>

      <BodySm className="text-xs text-muted-foreground">
        {copy.withdrawal}
      </BodySm>

      {/* Save commits the ticked purposes; it's inert until something is chosen —
          "Decline all" (text button, right) is the path when nothing is wanted. */}
      <div className="flex items-center justify-between gap-3">
        <Button disabled={pending || !anyChecked} onClick={() => submit(true)}>
          {copy.approve}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => submit(false)}
        >
          {copy.declineAll}
        </Button>
      </div>
    </div>
  )
}
