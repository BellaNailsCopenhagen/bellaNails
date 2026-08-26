"use client"

import { Button } from "@/components/ui/button"
import { useActionRunner } from "@/hooks/use-action-runner"
import { sendReminders } from "@/modules/booking/reminder-actions"

/**
 * Admin home action — email every client with a booking on the next studio-day.
 * Idempotent per booking, so a second click only catches newly-added ones. The
 * result (sent / skipped) is toasted by useActionRunner.
 */
export function SendRemindersButton() {
  const { pending, run } = useActionRunner()
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => run(sendReminders)}
    >
      {pending ? "Sending…" : "Send tomorrow's reminders"}
    </Button>
  )
}
