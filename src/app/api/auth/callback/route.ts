import { NextResponse } from "next/server"

import { safeInternalPath } from "@/shared/safe-next"

import { createSupabaseSessionServerClient } from "@/platform/supabase/ssr-server"

/**
 * OAuth (PKCE) callback for Supabase Auth. Google redirects here with a `code`;
 * we exchange it for a session (setting the Supabase auth cookies) and continue
 * to `next`. Lives under /api so it bypasses the proxy's locale routing.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  // One shared guard — the naive startsWith check let `/\evil.com` through.
  const dest = safeInternalPath(searchParams.get("next"))

  if (code) {
    const supabase = await createSupabaseSessionServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(dest, origin))
  }

  return NextResponse.redirect(new URL("/login?error=auth", origin))
}
