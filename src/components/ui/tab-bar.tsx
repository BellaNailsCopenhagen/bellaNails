"use client"

import type { ReactNode } from "react"

import { cn } from "@/shared/cn"

export type Tab<T extends string> = {
  value: T
  label: string
  count?: number
}

/** Shared style for a tab trigger (used by TabBar's tabs and any custom trigger,
    e.g. an icon-only tab passed via `trailing`) — one source of truth for the
    underline + active treatment. */
export function tabTriggerClassName(active: boolean): string {
  return cn(
    "-mb-px flex items-center gap-1.5 border-b-2 pb-2 font-functional text-xs uppercase tracking-widest-lux transition-colors",
    active
      ? "border-foreground text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground",
  )
}

/** Underlined tab bar with an optional count per tab, and an optional `trailing`
    slot pinned to the far right of the same row (align it with `ml-auto`).
    Controlled by the parent. */
export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
  trailing,
}: {
  tabs: Tab<T>[]
  active: T
  onChange: (value: T) => void
  trailing?: ReactNode
}) {
  return (
    <div
      role="tablist"
      className="flex items-center gap-5 border-b border-border"
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={active === tab.value}
          onClick={() => onChange(tab.value)}
          className={tabTriggerClassName(active === tab.value)}
        >
          {tab.label}
          {tab.count !== undefined ? (
            <span className="font-functional text-[0.625rem] text-muted-foreground">
              {tab.count}
            </span>
          ) : null}
        </button>
      ))}
      {trailing}
    </div>
  )
}
