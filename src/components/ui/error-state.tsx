import * as React from "react"

import { BodySm, Eyebrow, H3 } from "@/components/ui/typography"

/**
 * ErrorState — the shared "something went wrong" fallback. Mirrors EmptyState
 * in shape (optional eyebrow, heading, supporting line, and an action row via
 * children) so a full-page error boundary and an in-component boundary that
 * swaps out a single failed section read as one consistent thing.
 *
 * Presentational only — pass the retry/recovery actions as children. The retry
 * handler itself lives in the client boundary that renders this (it needs the
 * boundary's `unstable_retry`/`reset`), which keeps this component usable from
 * both server and client trees.
 */
function ErrorState({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  body: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <H3>{title}</H3>
        <BodySm className="max-w-md">{body}</BodySm>
      </div>
      {children ? (
        <div className="flex flex-wrap items-center gap-6">{children}</div>
      ) : null}
    </div>
  )
}

export { ErrorState }
