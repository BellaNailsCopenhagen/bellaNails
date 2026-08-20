"use client"

import { ChevronDown } from "lucide-react"

import { cn } from "@/shared/cn"
import { Eyebrow } from "@/components/ui/typography"

/** A labelled, count-badged section that collapses — shared by the client
    history and directory so the admin's collapsible lists behave identically. */
export function CollapsibleSection({
  label,
  count,
  open,
  onToggle,
  children,
}: {
  label: string
  count: number
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <Eyebrow as="span">{label}</Eyebrow>
        <span className="flex items-center gap-3">
          <span className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground">
            {count}
          </span>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </span>
      </button>
      {open ? children : null}
    </section>
  )
}
