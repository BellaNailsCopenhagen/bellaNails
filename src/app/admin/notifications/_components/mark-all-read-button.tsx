"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { markAllNotificationsRead } from "@/modules/notifications/actions"

export function MarkAllReadButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await markAllNotificationsRead()
          if (result.ok) router.refresh()
          else toast.error(result.error || "Couldn’t update.")
        })
      }
    >
      {pending ? "…" : "Mark all read"}
    </Button>
  )
}
