import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { hasLocale } from "next-intl"
import createMiddleware from "next-intl/middleware"

import { routes } from "./config/routes"
import { routing } from "./i18n/routing"

// next-intl handles locale negotiation + prefixing (/ → /da).
const handleI18nRouting = createMiddleware(routing)

// Routes that require a signed-in user. `/account` is the user profile;
// `/bookings` is the client's appointment list; `/admin` is the owner
// surface (owner-role refinement lands in Phase 8).
const isProtectedRoute = createRouteMatcher([
  "/(da|en)/account(.*)",
  "/(da|en)/bookings(.*)",
  "/(da|en)/admin(.*)",
])

/**
 * Next 16 uses `proxy.ts` (Node runtime) instead of `middleware.ts`.
 * @clerk/nextjs v7.5+ supports running `clerkMiddleware` from this file, so we
 * wrap next-intl in a single pass: Clerk establishes the auth context, then
 * next-intl does locale routing. Only ONE proxy file may exist, hence the merge.
 */
export default clerkMiddleware(async (auth, req) => {
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
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
}
