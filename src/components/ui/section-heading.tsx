import * as React from "react"

import { cn } from "@/lib/utils"

import { Eyebrow, H1, HeadingAccent, HeadingLine } from "./typography"

type SectionHeadingProps = {
  eyebrow: React.ReactNode
  lead: React.ReactNode
  accent?: React.ReactNode
  className?: string
  /**
   * Accent-line color. `"default"` inherits the heading color; `"secondary"`
   * is the muted brand tone (`#66635f`) used by the marketing sections.
   */
  accentTone?: "default" | "secondary"
}

/**
 * Reusable editorial section intro: small eyebrow plus a two-line heading.
 * Most marketing sections share this exact composition.
 */
function SectionHeading({
  eyebrow,
  lead,
  accent,
  className,
  accentTone = "default",
}: SectionHeadingProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <H1 as="h2">
        <HeadingLine>{lead}</HeadingLine>
        {accent ? (
          <HeadingAccent
            className={cn(
              accentTone === "secondary" && "text-[var(--bn-text-secondary)]",
            )}
          >
            {accent}
          </HeadingAccent>
        ) : null}
      </H1>
    </div>
  )
}

export { SectionHeading }
export type { SectionHeadingProps }
