"use client"

import type { ReactNode } from "react"
import { Star } from "lucide-react"

import { cn } from "@/shared/cn"

export function FavouritesToggle({
  active,
  onToggle,
  title,
  children,
}: {
  active: boolean
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
      <Star className={cn("size-3.5", active && "fill-current")} />
      {children}
    </button>
  )
}
