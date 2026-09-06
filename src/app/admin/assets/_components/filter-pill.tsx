"use client"

import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/shared/cn"

/**
 * An orthogonal filter on the hub — favourites, set-aside. These are the
 * artist's own marks on a photo: they apply in any state, so they sit beside the
 * tabs as toggles rather than competing for a place on the state ladder.
 */
export function FilterPill({
  icon: Icon,
  active,
  fillWhenActive = false,
  onToggle,
  title,
  children,
}: {
  icon: LucideIcon
  active: boolean
  /** Filling reads as "on" for a star. For a sparkle or a crossed-out eye it
      just fills the glyph in until it isn't one — opt in per icon. */
  fillWhenActive?: boolean
  onToggle: () => void
  title?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      title={title}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-functional text-[0.625rem] uppercase tracking-widest-lux transition-colors",
        active
          ? "border-secondary bg-secondary/10 text-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className={cn("size-3.5", active && fillWhenActive && "fill-current")} />
      {children}
    </button>
  )
}
