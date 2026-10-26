import { NextResponse } from "next/server"

import { resolveLocale } from "@/i18n/routing"
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
  // `next` always arrives locale-prefixed from the form; the fallback is reached
  // only by a hand-made callback URL, where negotiating the locale is right.
  const dest = safeInternalPath(searchParams.get("next"), "/")

  if (code) {
    const supabase = await createSupabaseSessionServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(dest, origin))
    }
  }

  // Report the failure in the language they were signing in from. `next` is
  // locale-prefixed (the form builds it that way), so its first segment is the
  // locale; a bare "/login" would be locale-negotiated afresh and could answer
  // a Danish sign-in in English.
  const locale = resolveLocale(dest.split("/")[1])

  return NextResponse.redirect(new URL(`/${locale}/login?error=auth`, origin))
}
