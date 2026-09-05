import { getLocale } from "next-intl/server"

import { BodySm, Eyebrow } from "@/components/ui/typography"
import { pickReleaseCopy } from "@/shared/media-release"

/**
 * How permission works, at the top of the Permissions tab. The emailed approval
 * page explains itself before it asks; a client deciding here — often about an
 * appointment nobody asked them about — deserves the same, or the choice isn't
 * an informed one. Copy comes from shared/media-release, so both surfaces say
 * the same thing in both languages.
 */
export async function ReleaseExplainer() {
  const copy = pickReleaseCopy(await getLocale())

  return (
    <section className="space-y-4 border-l-2 border-border pl-5">
      <Eyebrow as="h3">{copy.ui.explainTitle}</Eyebrow>
      <ol className="space-y-3">
        {copy.ui.explainSteps.map((step, index) => (
          <li key={step} className="flex gap-3">
            <span
              aria-hidden
              className="font-functional text-[0.625rem] leading-5 tracking-widest-lux text-muted-foreground"
            >
              {index + 1}
            </span>
            <BodySm className="max-w-prose text-xs text-muted-foreground">
              {step}
            </BodySm>
          </li>
        ))}
      </ol>
      <BodySm className="max-w-prose text-xs text-foreground">
        {copy.ui.explainNote}
      </BodySm>
    </section>
  )
}
