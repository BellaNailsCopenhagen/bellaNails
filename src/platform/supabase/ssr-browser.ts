"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

import { assertEnv } from "./env"
import type { Database } from "./types"

/**
 * Supabase-session browser client (@supabase/ssr). Owns its own cookie session
 * (Google OAuth, email OTP, sign-out) and drives authed browser reads + Realtime
 * auth. Singleton so one session is shared across the app.
 */
let browserClient: SupabaseClient<Database> | undefined

export function createSupabaseSessionBrowserClient(): SupabaseClient<Database> {
  browserClient ??= createBrowserClient<Database>(
    assertEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    assertEnv(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ),
  )
  return browserClient
}
