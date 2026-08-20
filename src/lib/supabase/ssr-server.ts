import "server-only"

import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

import { assertEnv } from "./env"
import type { Database } from "./types"

/**
 * Supabase-session server client (@supabase/ssr, cookie-based). Reads the
 * Supabase auth session from cookies so RLS sees `auth.uid()` / `app_metadata`.
 * Backs `createAuthedSupabaseServerClient` (user-scoped reads), the OAuth
 * callback, and the identity layer.
 *
 * Cookie writes are a safe no-op when called during an RSC render (Next forbids
 * setting cookies there); the proxy refreshes the session cookie instead. In a
 * Route Handler / Server Action the writes apply normally.
 */
export async function createSupabaseSessionServerClient(): Promise<
  SupabaseClient<Database>
> {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    assertEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    assertEnv(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // RSC render — cookie writes happen in the proxy on the next request.
          }
        },
      },
    },
  )
}
