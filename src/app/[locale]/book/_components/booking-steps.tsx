import { getTranslations } from "next-intl/server"

import { cn } from "@/shared/cn"
import { Caption } from "@/components/ui/typography"

/**
 * BookingSteps — the "01 · Customise 02 · Your details 03 · Confirm"
 * indicator shared by every booking step. `current` is 0-based; the active
 * step renders dark, the rest muted.
 */
export async function BookingSteps({ current }: { current: 0 | 1 | 2 }) {
  const t = await getTranslations("booking")
  const steps = [t("steps.customise"), t("steps.details"), t("steps.confirm")]

  return (
    <ol className="flex flex-wrap gap-x-4 gap-y-1">
      {steps.map((label, index) => (
        <Caption
          key={label}
          as="li"
          className={cn(
            "text-[11px] font-semibold tracking-widest-lux",
            index === current && "text-foreground",
          )}
        >
          {String(index + 1).padStart(2, "0")} · {label}
        </Caption>
      ))}
    </ol>
  )
}
