"use client"

import { MessageSquareQuote } from "lucide-react"

import { cardActionNeutral } from "@/components/admin/card-action"
import { useActionRunner } from "@/hooks/use-action-runner"
import { requestTestimonial } from "@/modules/testimonials/actions"

/**
 * Invite this client to write a few words. One open invitation per client is
 * enforced in the database, so tapping twice tells her it's already out rather
 * than sending a second nag.
 */
export function AskTestimonialButton({ clientId }: { clientId: string }) {
  const { pending, run } = useActionRunner()

  return (
    <button
      type="button"
      className={cardActionNeutral("gap-1")}
      disabled={pending}
      onClick={() =>
        run(async () => {
          const result = await requestTestimonial({ clientId })
          if (!result.ok) {
            return { ok: false, error: result.error }
          }

          return {
            ok: true,
            note: result.emailed
              ? "Invitation sent"
              : "Invitation created — no email on file, so it's in their My Space only",
          }
        })
      }
    >
      <MessageSquareQuote className="size-3.5" />
      Ask for a few words
    </button>
  )
}
