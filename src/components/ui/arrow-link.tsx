import * as React from "react"

import { Link } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

/**
 * Directional arrow that nudges along its axis on hover. Place inside an
 * element marked `group` (e.g. `ArrowLink`) so it reacts to the parent's
 * hover state. `back` points it left and nudges backward.
 */
function HoverArrow({
  className,
  back = false,
}: {
  className?: string
  back?: boolean
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "transition-transform",
        back ? "group-hover:-translate-x-0.5" : "group-hover:translate-x-0.5",
        className,
      )}
    >
      {back ? "←" : "→"}
    </span>
  )
}

type ArrowLinkProps = React.ComponentProps<typeof Link> & {
  /** Leading left arrow ("back to…") instead of the trailing forward arrow. */
  back?: boolean
}

/**
 * Editorial "view more" link — the uppercase luxe caption with a hover arrow
 * shared by the home-page section intros (services, gallery) and the booking
 * flow's back navigation (`back`).
 */
function ArrowLink({
  className,
  children,
  back = false,
  ...props
}: ArrowLinkProps) {
  return (
    <Link
      className={cn(
        "group inline-flex items-center gap-1.5 font-functional text-xs uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
      {...props}
    >
      {back ? <HoverArrow back /> : null}
      {children}
      {back ? null : <HoverArrow />}
    </Link>
  )
}

export { ArrowLink, HoverArrow }
