"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "@clerk/nextjs"

import { useSupabaseBrowserClient } from "@/lib/supabase/client"

// Coalesce a burst of webhook writes (create → sync → mirror) into one refresh.
const REFRESH_DEBOUNCE_MS = 400
// Clerk session tokens are short-lived (~60s); re-auth the realtime socket
// before expiry or it silently stops receiving RLS-scoped changes.
const TOKEN_REFRESH_MS = 50_000

/**
 * Live queue: subscribes to `bookings` changes and re-runs the admin RSC so new
 * or changed appointments appear without a manual reload. Owner-reads-all RLS
 * scopes the events to the whole studio.
 *
 * The realtime socket must carry the Clerk token or RLS delivers zero rows, so
 * we call `realtime.setAuth` explicitly before subscribing (the `accessToken`
 * client option doesn't reliably push it onto the socket for third-party auth)
 * and refresh it on an interval. Renders nothing.
 */
export function QueueRealtime() {
  const router = useRouter()
  const supabase = useSupabaseBrowserClient()
  const { session } = useSession()

  useEffect(() => {
    if (!session) return

    let debounce: ReturnType<typeof setTimeout> | undefined
    let cancelled = false

    const setRealtimeAuth = async () => {
      const token = await session.getToken()
      if (token && !cancelled) supabase.realtime.setAuth(token)
    }

    const channel = supabase.channel("admin-bookings").on(
      "postgres_changes",
      { event: "*", schema: "public", table: "bookings" },
      () => {
        if (debounce) clearTimeout(debounce)
        debounce = setTimeout(() => router.refresh(), REFRESH_DEBOUNCE_MS)
      },
    )

    // Authorize the socket, THEN subscribe.
    void setRealtimeAuth().then(() => {
      if (cancelled) return
      channel.subscribe()
    })

    const refresh = setInterval(setRealtimeAuth, TOKEN_REFRESH_MS)

    return () => {
      cancelled = true
      clearInterval(refresh)
      if (debounce) clearTimeout(debounce)
      void supabase.removeChannel(channel)
    }
  }, [supabase, session, router])

  return null
}
