import { NextResponse } from "next/server"

import { createSupabaseSessionServerClient } from "@/lib/supabase/ssr-server"

/**
 * OAuth (PKCE) callback for Supabase Auth. Google redirects here with a `code`;
 * we exchange it for a session (setting the Supabase auth cookies) and continue
 * to `next`. Lives under /api so it bypasses the proxy's locale routing.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/"
  // Only allow a local path (guard against open-redirect + absolute-URL crashes).
  const dest = next.startsWith("/") && !next.startsWith("//") ? next : "/"

  if (code) {
    const supabase = await createSupabaseSessionServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(dest, origin))
  }

  return NextResponse.redirect(new URL("/login?error=auth", origin))
}
