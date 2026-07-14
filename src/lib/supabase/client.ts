"use client"

import { useMemo } from "react"
import { useSession } from "@clerk/nextjs"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { assertEnv } from "./env"
import type { Database } from "./types"

/**
 * Browser Supabase client bound to the Clerk session.
 *
 * `accessToken` returns the Clerk session token when signed in (so RLS and
 * Realtime key off Clerk claims — `auth.jwt()->>'sub'` = the Clerk user id) and
 * `null` when signed out, in which case supabase-js falls back to the
 * publishable key (anon) so public catalog reads keep working. Memoized per
 * session so a fresh token is used across sign-in/out.
 */
export function useSupabaseBrowserClient(): SupabaseClient<Database> {
  const { session } = useSession()

  return useMemo(
    () =>
      createClient<Database>(
        assertEnv(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          "NEXT_PUBLIC_SUPABASE_URL",
        ),
        assertEnv(
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        ),
        { accessToken: async () => (await session?.getToken()) ?? null },
      ),
    [session],
  )
}
