"use client"

import { RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useActionRunner } from "@/hooks/use-action-runner"
import { recalculateInsights } from "@/modules/studio/income-actions"

/** Rebuild every past month from the appointments. Only needed when a month was
    frozen against opening hours that were wrong at the time. */
export function RecalculateButton() {
  const { pending, run } = useActionRunner()

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => run(recalculateInsights)}
    >
      <RotateCcw className="size-3.5" />
      {pending ? "Working it out…" : "Work it out again"}
    </Button>
  )
}
