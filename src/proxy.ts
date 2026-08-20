import { hasLocale } from "next-intl"
import createMiddleware from "next-intl/middleware"
import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { routing } from "./i18n/routing"
import { isOwnerUser } from "./lib/admin/owner"
import { assertEnv } from "./lib/supabase/env"

// next-intl handles locale negotiation + prefixing (/ → /da).
const handleI18nRouting = createMiddleware(routing)

// Signed-in-only client route: /appointments (My Space — bookings, gallery,
// requests, and account settings).
const isProtectedPath = (p: string) =>
  /^\/(da|en)\/appointments(\/|$)/.test(p)

// Carry the refreshed Supabase session cookies onto a redirect/rewrite response
// (they were set on `sessionResponse` by the client below, but that object may
// not be the one we return).
function withCookies(to: NextResponse, from: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) to.cookies.set(cookie)
  return to
}

/**
 * Next 16 uses `proxy.ts` (Node runtime). Supabase Auth: refresh the session
 * cookie on every request and read the VALIDATED user (getUser, not
 * the unverified cookie), then gate. /api is excluded by the matcher (webhooks,
 * OAuth callback, media all run without the proxy). This is an optimistic gate —
 * every admin RSC/action still re-checks via requireOwner.
 */
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const sessionResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    assertEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    assertEnv(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ),
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value, options } of cookiesToSet) {
            sessionResponse.cookies.set(name, value, options)
          }
        },
      },
    },
  )
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Admin: owner-only, non-localized. Skip i18n so the path stays /admin.
  // Signed-out → /login; signed-in non-owner → home (don't confirm the route).
  if (pathname.startsWith("/admin")) {
    if (!user) {
      const url = new URL("/login", request.url)
      url.searchParams.set("next", pathname)
      return withCookies(NextResponse.redirect(url), sessionResponse)
    }
    if (!isOwnerUser(user)) {
      return withCookies(
        NextResponse.redirect(new URL("/", request.url)),
        sessionResponse,
      )
    }
    return sessionResponse
  }

  // Protected client routes → sign in at the browsed locale, return after.
  if (isProtectedPath(pathname) && !user) {
    const seg = pathname.split("/")[1]
    const locale = hasLocale(routing.locales, seg) ? seg : routing.defaultLocale
    const url = new URL(`/${locale}/login`, request.url)
    url.searchParams.set("next", pathname)
    return withCookies(NextResponse.redirect(url), sessionResponse)
  }

  // Everything else: locale routing, carrying the refreshed session cookies.
  return withCookies(handleI18nRouting(request), sessionResponse)
}

export const config = {
  // Pages only — skip API routes, Next internals, and files with an extension.
  // /api/* (webhooks, /api/auth/callback, /api/media) run without the proxy;
  // their route handlers read the session cookie directly.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
}
