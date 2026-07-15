import * as React from "react"

import { BodySm, H3 } from "@/components/ui/typography"

/**
 * EmptyState — editorial "nothing here yet" block: heading, supporting line,
 * and an optional action row passed as children.
 */
function EmptyState({
  title,
  body,
  children,
}: {
  title: React.ReactNode
  body: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <H3>{title}</H3>
        <BodySm className="max-w-md">{body}</BodySm>
      </div>
      {children ? (
        <div className="flex flex-wrap items-center gap-6">{children}</div>
      ) : null}
    </div>
  )
}

export { EmptyState }
