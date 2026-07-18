import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { hasLocale } from "next-intl"
import createMiddleware from "next-intl/middleware"
import { NextResponse } from "next/server"

import { routes } from "./config/routes"
import { routing } from "./i18n/routing"
import { isOwner } from "./lib/admin/owner"

// next-intl handles locale negotiation + prefixing (/ → /da).
const handleI18nRouting = createMiddleware(routing)

// Routes that require a signed-in user. `/account` is the user profile;
// `/bookings` is the client's appointment list. `/admin` is handled
// separately below — it is a non-localized, owner-only surface.
const isProtectedRoute = createRouteMatcher([
  "/(da|en)/account(.*)",
  "/(da|en)/bookings(.*)",
])

// The admin PWA is English-only and NOT locale-prefixed, so it must bypass
// next-intl entirely (which would otherwise rewrite /admin → /da/admin).
const isAdminRoute = createRouteMatcher(["/admin(.*)"])

/**
 * Next 16 uses `proxy.ts` (Node runtime) instead of `middleware.ts`.
 * @clerk/nextjs v7.5+ supports running `clerkMiddleware` from this file, so we
 * wrap next-intl in a single pass: Clerk establishes the auth context, then
 * next-intl does locale routing. Only ONE proxy file may exist, hence the merge.
 */
export default clerkMiddleware(async (auth, req) => {
  // Admin: owner-only, non-localized. Gate here and skip i18n routing so the
  // path stays /admin (never /da/admin). Signed-out → sign-in; signed-in but
  // not the owner → home (don't confirm the route exists with a 403/404).
  if (isAdminRoute(req)) {
    const { userId, sessionClaims, redirectToSignIn } = await auth()
    if (!userId) {
      return redirectToSignIn({ returnBackUrl: req.url })
    }
    // Owner role read from the session token (see lib/admin/owner). Non-owners
    // go home rather than a 403/404 — don't confirm the route exists.
    if (!isOwner(sessionClaims)) {
      return NextResponse.redirect(new URL("/", req.url))
    }
    return NextResponse.next()
  }

  if (isProtectedRoute(req)) {
    // Require a signed-in user, redirecting to the sign-in of the locale
    // being browsed (the env default is /da only) and back here after auth.
    // Owner-role refinement for /admin lands with Phase 8.
    const seg = req.nextUrl.pathname.split("/")[1]
    // Validate against routing (matcher is case-insensitive: "/En/…" must
    // not become a /En/sign-in 404).
    const locale = hasLocale(routing.locales, seg) ? seg : routing.defaultLocale
    const returnTo = req.nextUrl.clone()
    returnTo.searchParams.delete("_rsc") // RSC fetch param — not a page URL
    const signInUrl = new URL(`/${locale}${routes.signIn}`, req.url)
    signInUrl.searchParams.set("redirect_url", returnTo.toString())
    await auth.protect({ unauthenticatedUrl: signInUrl.toString() })
  }
  return handleI18nRouting(req)
})

export const config = {
  // Skip API routes, Next internals, and files with an extension (assets).
  // The PWA manifest (/manifest.webmanifest) and icons (/icons/*.png) all
  // carry a dot, so they're excluded here and served without locale routing;
  // the admin apple-touch icon lives under /admin (owner-gated above).
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
}
