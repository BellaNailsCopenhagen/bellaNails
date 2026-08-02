"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

type ActionResult = { ok: boolean; error?: string; note?: string }

/**
 * Run a server action inside a transition: on success show its optional `note`
 * and refresh the route; on failure — or a thrown error — toast the message.
 * Shared by the client consent / gallery / asset-hub controls so the
 * transition + refresh + error plumbing lives in exactly one place.
 */
export function useActionRunner(fallbackError = "Something went wrong.") {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const run = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      try {
        const result = await action()
        if (!result.ok) {
          toast.error(result.error || fallbackError)
          return
        }
        if (result.note) toast.success(result.note)
        router.refresh()
      } catch {
        toast.error(fallbackError)
      }
    })

  return { pending, run }
}
