"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { useSupabaseBrowserClient } from "@/platform/supabase/client"

// Coalesce a burst of webhook writes (create → sync → mirror) into one refresh.
const REFRESH_DEBOUNCE_MS = 400

/**
 * Live queue: subscribes to every table the home screen renders (`bookings`,
 * and the two request queues) and re-runs the admin RSC so new
 * or changed appointments appear without a manual reload. Owner-reads-all RLS
 * scopes the events to the whole studio. The @supabase/ssr browser client
 * carries (and refreshes) the session token on the realtime socket itself, so
 * no manual setAuth is needed. Renders nothing.
 */
export function QueueRealtime() {
  const router = useRouter()
  const supabase = useSupabaseBrowserClient()

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | undefined

    const refresh = () => {
      if (debounce) {
        clearTimeout(debounce)
      }
      debounce = setTimeout(() => router.refresh(), REFRESH_DEBOUNCE_MS)
    }

    // One debounced refresh across all three — the page reads them together.
    const channel = ["bookings", "booking_requests", "design_requests"]
      .reduce(
        (ch, table) =>
          ch.on(
            "postgres_changes",
            { event: "*", schema: "public", table },
            refresh,
          ),
        supabase.channel("admin-queue"),
      )
      .subscribe()

    return () => {
      if (debounce) {
        clearTimeout(debounce)
      }
      void supabase.removeChannel(channel)
    }
  }, [supabase, router])

  return null
}
