"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** Refreshes the command centre every 60 s so "now → next" rolls over as time
    passes (QueueRealtime only fires on DB changes, not the wall clock). */
export function CommandTick() {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 60_000)

    return () => clearInterval(id)
  }, [router])

  return null
}
