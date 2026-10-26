"use client"

import { useState } from "react"
import { useLocale } from "next-intl"

import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { TintedCard } from "@/components/ui/tinted-card"
import { BodySm, Eyebrow, H3 } from "@/components/ui/typography"
import { useActionRunner } from "@/hooks/use-action-runner"
import { preApproveRelease } from "@/modules/media/release-actions"
import {
  pickReleaseCopy,
  releaseErrorCopy,
  RELEASE_PURPOSES,
  type ReleasePurpose,
} from "@/shared/media-release"

/**
 * The signed-in confirmation's primary block: an optional media-release opt-in.
 * The booking is already made, so this is unbundled from the service (GDPR
 * Art. 7(4)) — a free, skippable choice. Grants only the ticked purposes;
 * whatever's left the artist can request later. On save (or via the secondary
 * link) it hands back to the normal "manage your booking" confirmation.
 */
export function ConfirmationRelease({
  token,
  signedInBody,
  viewBookingsLabel,
  appointmentsHref,
}: {
  token: string
  signedInBody: string
  viewBookingsLabel: string
  appointmentsHref: string
}) {
  const locale = useLocale()
  const copy = pickReleaseCopy(locale)
  const { pending, run } = useActionRunner(copy.errors.unknown)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState(false)

  const anyChecked = RELEASE_PURPOSES.some((p) => checked[p])

  // After a choice (or if they never opt in) — the normal manage-your-booking note.
  if (saved) {
    return (
      <div className="space-y-4">
        <BodySm className="text-success">{copy.granted}</BodySm>
        <BodySm className="max-w-md">{signedInBody}</BodySm>
        <Button nativeButton={false} render={<Link href={appointmentsHref} />}>
          {viewBookingsLabel}
        </Button>
      </div>
    )
  }

  const submit = () =>
    run(async () => {
      const chosen = RELEASE_PURPOSES.filter((p) => checked[p])
      const result = await preApproveRelease(token, chosen)
      if (result.ok) {
        setSaved(true)
      }

      // The action answers with a code; saying it out loud is our job.
      return result.ok
        ? result
        : { ...result, error: releaseErrorCopy(locale, result.error) }
    })

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Eyebrow className="font-normal">{copy.heading}</Eyebrow>
        <H3>
          {copy.requestTitle.lead} {copy.requestTitle.muted}
        </H3>
        <BodySm className="max-w-md">
          {copy.honoured} {copy.intro}
        </BodySm>
      </div>

      <p className="font-functional text-sm font-medium text-foreground">
        {copy.choose}
      </p>

      <div className="max-w-md space-y-3">
        {RELEASE_PURPOSES.map((purpose) => {
          const p = purpose as ReleasePurpose

          return (
            <TintedCard key={purpose} className="flex items-start gap-3 p-4">
              <Checkbox
                id={`confirm-${purpose}`}
                checked={Boolean(checked[purpose])}
                onCheckedChange={(value) =>
                  setChecked((prev) => ({ ...prev, [purpose]: value === true }))
                }
                disabled={pending}
              />
              <label
                htmlFor={`confirm-${purpose}`}
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

      <BodySm className="max-w-md text-xs text-muted-foreground">
        {copy.withdrawal}
      </BodySm>

      <div className="flex flex-wrap items-center gap-5">
        <Button disabled={pending || !anyChecked} onClick={submit}>
          {copy.approve}
        </Button>
        {/* Skip — go straight to managing the booking. */}
        <Link
          href={appointmentsHref}
          className="font-functional text-sm text-muted-foreground underline decoration-dotted underline-offset-4 transition-colors hover:text-foreground"
        >
          {viewBookingsLabel}
        </Link>
      </div>
    </div>
  )
}
