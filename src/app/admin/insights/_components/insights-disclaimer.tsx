import { Info } from "lucide-react"

import { BodySm } from "@/components/ui/typography"

/**
 * Pinned at the top, every time, never a footnote.
 *
 * These figures are the studio's own booking totals plus the artist's own
 * corrections. They have never seen a card fee, a VAT return, or a note handed
 * over in cash. Read as accounting they would be wrong in ways that matter to a
 * tax office, so the screen has to say what it is before it shows a number.
 */
export function InsightsDisclaimer() {
  return (
    <div className="flex gap-3 rounded-md border border-border bg-muted/40 p-4">
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="space-y-1">
        <p className="font-functional text-sm font-medium text-foreground">
          For information only — not an accounting or tax record.
        </p>
        <BodySm className="max-w-prose text-xs text-muted-foreground">
          These come from your booked prices and any amounts you&rsquo;ve
          corrected yourself. They don&rsquo;t know about card fees, VAT, tips,
          or anything settled outside the app. Useful for a sense of how things
          are going; not something to file.
        </BodySm>
      </div>
    </div>
  )
}
