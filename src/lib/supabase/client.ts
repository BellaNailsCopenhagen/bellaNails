import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { assertEnv } from "./env";
import type { Database } from "./types";

/**
 * Browser (client-component) Supabase client, memoized as a singleton.
 *
 * Uses the public anon key; row access is governed by RLS. Phase 4 (Clerk)
 * will attach the Clerk session token via the `accessToken` option so authed
 * reads and Realtime subscriptions key off Clerk claims.
 */
let browserClient: SupabaseClient<Database> | undefined;

export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  browserClient ??= createClient<Database>(
    assertEnv(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      "NEXT_PUBLIC_SUPABASE_URL",
    ),
    assertEnv(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ),
    {
      // We don't use Supabase Auth — Clerk owns sessions (Phase 4 wires the
      // Clerk token via `accessToken`). Turn off the GoTrue browser machinery
      // so it doesn't parse/strip OAuth-shaped URL params (detectSessionInUrl)
      // or spin up needless localStorage writes + refresh timers.
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  return browserClient;
}
