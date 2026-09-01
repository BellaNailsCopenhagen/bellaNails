"use client"

import {
  ConfirmActionButton,
  restoreLink,
  withdrawPill,
} from "@/components/ui/confirm-action-button"
import { useActionRunner } from "@/hooks/use-action-runner"
import {
  eraseMyTestimonial,
  restoreTestimonial,
  withdrawTestimonial,
} from "@/modules/testimonials/actions"
import type { TestimonialState } from "@/shared/testimonial"

/**
 * The client's controls on their own words. A client component because a server
 * component can't hand a closure across the boundary — and because the labels
 * come from the server, they're passed in rather than re-resolved here.
 */
export type TestimonialControlLabels = {
  withdraw: string
  withdrawing: string
  withdrawTitle: string
  withdrawBody: string
  withdrawConfirm: string
  withdrawCancel: string
  restore: string
  restoring: string
  erase: string
  erasing: string
  eraseTitle: string
  eraseBody: string
  eraseConfirm: string
  eraseCancel: string
  failed: string
}

export function TestimonialControls({
  id,
  state,
  labels,
}: {
  id: string
  state: TestimonialState
  labels: TestimonialControlLabels
}) {
  const { pending, run } = useActionRunner(labels.failed)
  // Derived here, from the same state the badge shows, so a control can never
  // offer what the server action would refuse.
  const canWithdraw = state === "showing" || state === "waiting"
  const canRestore = state === "takenDown"
  const canErase = state !== "erased"

  return (
    <div className="flex flex-wrap items-center gap-4">
      {canWithdraw ? (
        <ConfirmActionButton
          action={() => withdrawTestimonial(id)}
          labels={{
            title: labels.withdrawTitle,
            body: labels.withdrawBody,
            confirm: labels.withdrawConfirm,
            confirming: labels.withdrawing,
            cancel: labels.withdrawCancel,
            failed: labels.failed,
          }}
          trigger={
            <button type="button" className={withdrawPill}>
              {labels.withdraw}
            </button>
          }
        />
      ) : null}

      {/* Putting your own words back isn't destructive, so no dialog — a
          confirmation here would make the reversible path feel heavier than
          the irreversible one. */}
      {canRestore ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => restoreTestimonial(id))}
          className={restoreLink}
        >
          {pending ? labels.restoring : labels.restore}
        </button>
      ) : null}

      {canErase ? (
        <ConfirmActionButton
          action={() => eraseMyTestimonial(id)}
          labels={{
            title: labels.eraseTitle,
            body: labels.eraseBody,
            confirm: labels.eraseConfirm,
            confirming: labels.erasing,
            cancel: labels.eraseCancel,
            failed: labels.failed,
          }}
          trigger={
            <button type="button" className={withdrawPill}>
              {labels.erase}
            </button>
          }
        />
      ) : null}
    </div>
  )
}
