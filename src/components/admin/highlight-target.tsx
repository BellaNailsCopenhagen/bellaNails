"use client"

import { useEffect } from "react"

const RING = ["ring-2", "ring-foreground", "ring-offset-2"] as const

/**
 * Scroll an element into view and ring it for a moment. Exported for callers
 * that already own an effect (the asset hub re-runs it when a filter change
 * finally renders the target).
 */
export function flashHighlight(elementId: string): (() => void) | undefined {
  const el = document.getElementById(elementId)
  if (!el) return undefined
  el.scrollIntoView({ behavior: "smooth", block: "center" })
  el.classList.add(...RING)
  const timer = setTimeout(() => el.classList.remove(...RING), 2200)
  return () => clearTimeout(timer)
}

/**
 * Land a deep link ON its item. A `#hash` can't do this here: the pages worth
 * linking into are `force-dynamic`, so the browser looks for the anchor before
 * the card has streamed in, finds nothing, and leaves you at the top of a list
 * to match the notification's wording against twenty cards by hand.
 *
 * Mounting after the payload means the element is there — so the scroll is
 * driven from a `?focus=` param instead.
 */
export function HighlightTarget({ elementId }: { elementId: string | null }) {
  useEffect(() => {
    if (!elementId) return
    return flashHighlight(elementId)
  }, [elementId])

  return null
}
