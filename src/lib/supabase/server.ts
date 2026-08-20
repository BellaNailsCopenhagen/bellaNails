import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { assertEnv } from "./env"
import { createSupabaseSessionServerClient } from "./ssr-server"
import type { Database } from "./types"

// No session persistence on the server — each request builds a fresh client
// and there is no browser storage to sync to.
const SERVER_AUTH = { persistSession: false, autoRefreshToken: false } as const

/**
 * Anonymous server (RSC / route handler) client using the public anon key —
 * no user identity attached. Use for public content (services, gallery) where
 * RLS's `to anon` policies apply; it carries no user session, so it stays
 * static-rendering friendly. For user-scoped reads use the authed client below.
 */
export function createSupabaseServerClient(): SupabaseClient<Database> {
  return createClient<Database>(
    assertEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    assertEnv(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ),
    { auth: SERVER_AUTH },
  )
}

/**
 * Server client bound to the current Supabase Auth session (cookie-based, via
 * @supabase/ssr), so RLS sees `auth.uid()` / `app_metadata` and a user reads
 * only their own rows. Async — reads the request cookies — which makes any page
 * using it dynamic, hence it's separate from the anon client above. Await it.
 */
export function createAuthedSupabaseServerClient(): Promise<
  SupabaseClient<Database>
> {
  return createSupabaseSessionServerClient()
}

/**
 * Service-role Supabase client — **bypasses RLS**. Server-only, for trusted
 * mutations where there is no end-user session: the Cal.com webhook upsert and
 * owner/admin writes. Never import this from client code or expose its results
 * without an explicit authorization check.
 */
export function createSupabaseServiceRoleClient(): SupabaseClient<Database> {
  return createClient<Database>(
    // The URL is the public project URL (same for every key); only the paired
    // SERVICE_ROLE key below is secret. Do not swap in any other NEXT_PUBLIC_ var.
    assertEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    assertEnv(
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      "SUPABASE_SERVICE_ROLE_KEY",
    ),
    { auth: SERVER_AUTH },
  )
}
