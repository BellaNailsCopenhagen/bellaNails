import * as React from "react"

import { cn } from "@/lib/utils"

import { Skeleton } from "./skeleton"

import {
  BodySm,
  Display,
  Eyebrow,
  HeadingLine,
  HeadingMuted,
} from "./typography"

type PageHeaderProps = {
  eyebrow: React.ReactNode
  /** First (dark) display line. */
  lead: React.ReactNode
  /** Second display line in the muted brand tone. */
  muted?: React.ReactNode
  /** Supporting note, right column on md+ (bottom-aligned), stacked below. */
  intro?: React.ReactNode
  className?: string
}

/**
 * PageHeader — the shared editorial page intro used by /services and the
 * /book steps: muted eyebrow, two-line display heading (dark lead + muted
 * continuation), and a supporting note in a right-hand column. One component
 * so the composition can't drift between pages.
 */
function PageHeader({
  eyebrow,
  lead,
  muted,
  intro,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "grid gap-x-16 gap-y-8 pb-16 md:grid-cols-[1fr_19rem] md:items-end",
        className,
      )}
    >
      <div className="space-y-6">
        <Eyebrow>{eyebrow}</Eyebrow>
        <Display>
          <HeadingLine>{lead}</HeadingLine>
          {muted ? <HeadingMuted>{muted}</HeadingMuted> : null}
        </Display>
      </div>
      {intro ? <BodySm>{intro}</BodySm> : null}
    </div>
  )
}

/** Loading ghost matching PageHeader's shape — keep in sync with the real
    header so loading.tsx files don't jump when content streams in. */
function PageHeaderSkeleton() {
  return (
    <div className="space-y-6 pb-16">
      <Skeleton className="h-3 w-44" />
      <Skeleton className="h-12 w-64 sm:h-14 sm:w-80" />
      <Skeleton className="h-3 w-72 max-w-full" />
    </div>
  )
}

export { PageHeader, PageHeaderSkeleton }
export type { PageHeaderProps }
