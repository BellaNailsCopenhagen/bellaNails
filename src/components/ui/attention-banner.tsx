"use client"

import type * as React from "react"
import { Bell, ChevronRight } from "lucide-react"

import { Link } from "@/i18n/navigation"

/**
 * "Something is waiting for you" — the one bar shared by the home page (which
 * navigates to My Space) and My Space itself (which just switches tab). It was
 * two components with two sets of copy and two borders that had already drifted.
 *
 * `href` navigates; `onClick` doesn't. My Space needs the second: a link to the
 * page you are already on is a no-op the moment the URL already carries the
 * query it would set.
 */
type AttentionBannerProps = {
  /** The headline — what happened. */
  text: string
  /** The muted tail — what to do about it. */
  tap: string
  className?: string
} & (
  | { href: React.ComponentProps<typeof Link>["href"]; onClick?: never }
  | { onClick: () => void; href?: never }
)

const shell =
  "flex w-full items-center gap-3 text-left font-functional text-sm text-foreground transition-colors"

export function AttentionBanner({
  text,
  tap,
  className,
  href,
  onClick,
}: AttentionBannerProps) {
  const body = (
    <>
      <Bell className="size-4 shrink-0 text-secondary" />
      <span className="min-w-0 flex-1">
        {text}
        <span className="text-muted-foreground"> — {tap}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </>
  )

  if (href) {
    return (
      <Link href={href} className={`${shell} ${className ?? ""}`}>
        {body}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className={`${shell} ${className ?? ""}`}>
      {body}
    </button>
  )
}

/** The home page's full-bleed bar, sitting under the header. */
export const bannerBar =
  "border-b border-border bg-secondary/10 px-6 py-3 hover:bg-secondary/20"

/** The in-page card, inside a container that already has its own gutter. */
export const bannerCard =
  "rounded-lg border border-secondary/30 bg-secondary/10 px-4 py-3 hover:bg-secondary/20"
