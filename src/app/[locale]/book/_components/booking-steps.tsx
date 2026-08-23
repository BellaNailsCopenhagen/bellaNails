import { getTranslations } from "next-intl/server"

import { cn } from "@/shared/cn"
import { Caption } from "@/components/ui/typography"

/**
 * BookingSteps — the "01 · Customise 02 · Your details 03 · Confirm"
 * indicator shared by every booking step. `current` is 0-based (full scheme);
 * the active step renders dark, the rest muted. `skipCustomise` drops the
 * customise step for services with no add-ons, renumbering the two that remain.
 */
export async function BookingSteps({
  current,
  skipCustomise = false,
}: {
  current: 0 | 1 | 2
  skipCustomise?: boolean
}) {
  const t = await getTranslations("booking")
  const all = [t("steps.customise"), t("steps.details"), t("steps.confirm")]
  const steps = skipCustomise ? all.slice(1) : all
  const active = skipCustomise ? current - 1 : current

  return (
    <ol className="flex flex-wrap gap-x-4 gap-y-1">
      {steps.map((label, index) => (
        <Caption
          key={label}
          as="li"
          className={cn(
            "text-[11px] font-semibold tracking-widest-lux",
            index === active && "text-foreground",
          )}
        >
          {String(index + 1).padStart(2, "0")} · {label}
        </Caption>
      ))}
    </ol>
  )
}
