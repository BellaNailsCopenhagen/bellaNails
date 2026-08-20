"use client"

import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"

import { createSupabaseSessionBrowserClient } from "@/lib/supabase/ssr-browser"

/**
 * The signed-in user on the client (Supabase session), reactive to sign-in /
 * sign-out. Client-side counterpart to identity/server.ts `getCurrentUser`.
 * Also resolves `clientId` (the `clients` row linked to the auth user) so
 * personal surfaces can filter by it — the owner's owner-reads-all RLS would
 * otherwise surface studio-wide rows on their own pages.
 */
export function useCurrentUser(): {
  user: User | null
  clientId: string | null
  loading: boolean
} {
  const [user, setUser] = useState<User | null>(null)
  const [clientId, setClientId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createSupabaseSessionBrowserClient()
    let active = true
    let currentUserId: string | null = null // guards stale clients lookups

    // Deferred (setTimeout) so we don't call supabase inside the auth-change
    // callback's lock — the documented re-entrancy hazard.
    const loadClient = (u: User | null) => {
      currentUserId = u?.id ?? null
      if (!u) {
        setClientId(null)
        return
      }
      setTimeout(async () => {
        const { data } = await supabase
          .from("clients")
          .select("id")
          .eq("auth_user_id", u.id)
          .maybeSingle()
        // Drop a resolution the user has since changed away from.
        if (active && currentUserId === u.id) setClientId(data?.id ?? null)
      }, 0)
    }

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return
      setUser(data.user)
      loadClient(data.user)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      const u = session?.user ?? null
      setUser(u)
      loadClient(u)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return { user, clientId, loading }
}
