import { cn } from "@/lib/utils"

/**
 * Shared typographic treatment for a booking card's footer *text* actions, so
 * the contact links (Call/Email) and the soft destructive actions (Cancel,
 * No-show) read as one quiet family. Reschedule/Rebook stays a `Button` — the
 * card's single primary action — so the hierarchy is: primary button vs. quiet
 * text, and neutral (contact) vs. destructive (Cancel/No-show) by colour.
 */
const base =
  "flex items-center gap-1.5 font-functional text-xs uppercase tracking-widest-lux transition-colors disabled:opacity-50"

export const cardActionNeutral = (className?: string) =>
  cn(base, "text-foreground/70 hover:text-foreground", className)

export const cardActionDestructive = (className?: string) =>
  cn(base, "text-destructive/70 hover:text-destructive", className)
