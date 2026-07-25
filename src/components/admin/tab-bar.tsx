"use client"

import { cn } from "@/lib/utils"

export type Tab<T extends string> = {
  value: T
  label: string
  count?: number
}

/** Underlined tab bar with an optional count per tab. Controlled by the parent. */
export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: Tab<T>[]
  active: T
  onChange: (value: T) => void
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
          className={cn(
            "-mb-px flex items-center gap-1.5 border-b-2 pb-2 font-functional text-xs uppercase tracking-widest-lux transition-colors",
            active === tab.value
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
          {tab.count !== undefined ? (
            <span className="font-functional text-[0.625rem] text-muted-foreground">
              {tab.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  )
}
