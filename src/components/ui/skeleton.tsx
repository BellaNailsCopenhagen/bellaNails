import { cn } from "@/lib/utils"

/**
 * Skeleton — pulsing placeholder block for route-level loading screens.
 * Size it with width/height utilities at the call site.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-sm bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
