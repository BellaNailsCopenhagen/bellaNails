"use client"

import * as React from "react"
import { RotateCcw, UserX } from "lucide-react"
import { toast } from "sonner"

import {
  cardActionDestructive,
  cardActionNeutral,
} from "@/components/admin/card-action"
import {
  setBookingNoShow,
} from "@/modules/booking/actions"

/**
 * Toggle the studio-side no-show marker. Reversible, so it fires directly (no
 * confirm dialog); the server action re-verifies the owner role and eligibility
 * and revalidates the admin surfaces.
 */
export function AdminNoShowButton({
  uid,
  marked,
}: {
  uid: string
  marked: boolean
}) {
  const [pending, startTransition] = React.useTransition()

  const toggle = () =>
    startTransition(async () => {
      try {
        const result = await setBookingNoShow(uid, !marked)
        if (result.ok) {
          toast.success(marked ? "No-show cleared" : "Marked as no-show")
        } else {
          toast.error("Couldn’t update the no-show — try again.")
        }
      } catch {
        // A thrown action must still resolve the UI.
        toast.error("Couldn’t update the no-show — try again.")
      }
    })

  // Marking is destructive (red); clearing is a neutral undo.
  const Icon = marked ? RotateCcw : UserX

  return (
    <button
      type="button"
      disabled={pending}
      onClick={toggle}
      className={marked ? cardActionNeutral() : cardActionDestructive()}
    >
      <Icon className="size-3.5" />
      {pending ? "Saving…" : marked ? "Clear no-show" : "Mark no-show"}
    </button>
  )
}
