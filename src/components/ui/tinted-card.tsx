import * as React from "react"

import { cn } from "@/shared/cn"

/**
 * TintedCard — the muted panel shell used for every appointment-shaped card:
 * the running summary, the confirmation recap states, and the bookings-list
 * cards. One component so the treatment (radius, border, tint, padding)
 * can't drift between surfaces that render side by side.
 */
function TintedCard({
  as,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  /** Render as a different element ("li", "aside", …) — defaults to div. */
  as?: React.ElementType
}) {
  const Comp = as ?? "div"
  return (
    <Comp
      className={cn(
        "w-full rounded-lg border border-border bg-muted/60 p-6 sm:p-8",
        className,
      )}
      {...props}
    />
  )
}

export { TintedCard }
