"use client"

import { ChevronDown, ListFilter } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * A compact single-select filter dropdown — the secondary control next to a
 * primary segmented toggle. Uses the brand dropdown (2px radius, nav-style
 * items) but a smaller font, since a filter sits below the nav in hierarchy.
 */
export function FilterMenu<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T
  options: readonly (readonly [T, string])[]
  onChange: (next: T) => void
  ariaLabel?: string
}) {
  const label =
    options.find(([option]) => option === value)?.[1] ?? options[0]?.[1] ?? ""

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={ariaLabel}
        className="flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground data-[popup-open]:text-foreground"
      >
        <ListFilter className="size-3.5" />
        {label}
        <ChevronDown className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => onChange(next as T)}
        >
          {options.map(([option, optionLabel]) => (
            <DropdownMenuRadioItem
              key={option}
              value={option}
              className="text-[0.625rem]"
            >
              {optionLabel}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
