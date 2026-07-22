import { cn } from "@/lib/utils"

/** A card's quiet footer text-actions, neutral vs. destructive by colour —
    kept visually below the primary Reschedule `Button`. */
const base =
  "flex cursor-pointer items-center gap-1.5 font-functional text-xs uppercase tracking-widest-lux transition-colors disabled:cursor-not-allowed disabled:opacity-50"

export const cardActionNeutral = (className?: string) =>
  cn(base, "text-foreground/70 hover:text-foreground", className)

export const cardActionDestructive = (className?: string) =>
  cn(base, "text-destructive/70 hover:text-destructive", className)
