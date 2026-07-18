"use client"

import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"

/**
 * Admin route error boundary. Because /admin is its own root layout, it needs
 * its own boundary — otherwise a thrown admin page falls through to the
 * app-root global-error and loses the shell. This renders inside AdminShell,
 * so the header + tab bar stay put while a single screen recovers.
 */
export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="py-8">
      <ErrorState
        eyebrow="Studio"
        title="Something went wrong"
        body="This screen couldn’t load. Try again in a moment."
      >
        <Button onClick={reset}>Try again</Button>
      </ErrorState>
    </div>
  )
}
