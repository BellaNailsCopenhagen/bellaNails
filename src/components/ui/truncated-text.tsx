"use client"

import { useState } from "react"

// Char-based so overflow is known without measuring the DOM — the Read-more
// button appears only when the text is actually longer than the limit.
const DEFAULT_LIMIT = 160

/** Body text that truncates past `limit` characters with a Read-more toggle;
    below the limit it renders in full with no button. Preserves line breaks. */
export function TruncatedText({
  text,
  limit = DEFAULT_LIMIT,
  className,
}: {
  text: string
  limit?: number
  className?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const needsTrim = text.length > limit
  const shown =
    !needsTrim || expanded ? text : `${text.slice(0, limit).trimEnd()}…`

  return (
    <div className={className}>
      <p className="whitespace-pre-wrap font-functional text-sm text-foreground">
        {shown}
      </p>
      {needsTrim ? (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-0.5 font-functional text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      ) : null}
    </div>
  )
}
