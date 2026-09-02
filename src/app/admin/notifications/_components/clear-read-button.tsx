"use client"

import { ConfirmActionButton } from "@/components/ui/confirm-action-button"
import { cardActionDestructive } from "@/components/admin/card-action"
import { clearReadNotifications } from "@/modules/notifications/actions"

/**
 * Empties the read pile — ALL of it, not only the page's first fifty, which is
 * why it says so and asks first. The feed is a to-do list; the record of what
 * was sent lives in the client's communications log.
 */
export function ClearReadButton() {
  return (
    <ConfirmActionButton
      action={clearReadNotifications}
      trigger={
        <button type="button" className={cardActionDestructive()}>
          Clear all read
        </button>
      }
      labels={{
        title: "Clear all read notifications?",
        body: "Every notification you have already opened is deleted, including any not shown on this page. What was emailed to a client stays on their profile.",
        confirm: "Clear them",
        confirming: "Clearing…",
        cancel: "Keep them",
        failed: "Couldn’t clear those.",
      }}
    />
  )
}
