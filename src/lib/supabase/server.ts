import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { assertEnv } from "./env";
import type { Database } from "./types";

// No session persistence on the server — each request builds a fresh client
// and there is no browser storage to sync to.
const SERVER_AUTH = { persistSession: false, autoRefreshToken: false } as const;

/**
 * Server (RSC / route handler) Supabase client using the public anon key.
 * Reads are governed by RLS; use this for public content (services, gallery).
 * Phase 4 (Clerk) will pass the request's Clerk token via `accessToken` so
 * authed queries key off Clerk claims.
 */
export function createSupabaseServerClient(): SupabaseClient<Database> {
  return createClient<Database>(
    assertEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    assertEnv(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ),
    { auth: SERVER_AUTH },
  );
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
  );
}
