"use client"

import type { SupabaseClient } from "@supabase/supabase-js"

import { createSupabaseSessionBrowserClient } from "./ssr-browser"
import type { Database } from "./types"

/**
 * Browser Supabase client bound to the Supabase Auth session (@supabase/ssr).
 * It owns its cookie session, so RLS + Realtime key off `auth.uid()` /
 * `app_metadata` when signed in and fall back to anon (public catalog) when not.
 * Thin wrapper over the singleton so existing call sites keep the same hook.
 */
export function useSupabaseBrowserClient(): SupabaseClient<Database> {
  return createSupabaseSessionBrowserClient()
}
