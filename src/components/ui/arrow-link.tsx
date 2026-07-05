import * as React from "react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Right-pointing arrow that nudges forward on hover. Place inside an element
 * marked `group` (e.g. `ArrowLink`) so it reacts to the parent's hover state.
 */
function HoverArrow({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "transition-transform group-hover:translate-x-0.5",
        className,
      )}
    >
      →
    </span>
  );
}

type ArrowLinkProps = React.ComponentProps<typeof Link>;

/**
 * Editorial "view more" link — the uppercase luxe caption with a trailing
 * hover arrow shared by the home-page section intros (services, gallery).
 */
function ArrowLink({ className, children, ...props }: ArrowLinkProps) {
  return (
    <Link
      className={cn(
        "group inline-flex items-center gap-1.5 font-functional text-xs uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
      <HoverArrow />
    </Link>
  );
}

export { ArrowLink, HoverArrow };
