import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

// next-intl handles locale negotiation + prefixing (/ → /da).
const handleI18nRouting = createMiddleware(routing);

// Owner-gated admin surface (the shell lands in Phase 8). Locale-prefixed.
const isAdminRoute = createRouteMatcher(["/(da|en)/admin(.*)"]);

/**
 * Next 16 uses `proxy.ts` (Node runtime) instead of `middleware.ts`.
 * @clerk/nextjs v7.5+ supports running `clerkMiddleware` from this file, so we
 * wrap next-intl in a single pass: Clerk establishes the auth context, then
 * next-intl does locale routing. Only ONE proxy file may exist, hence the merge.
 */
export default clerkMiddleware(async (auth, req) => {
  if (isAdminRoute(req)) {
    // Require a signed-in user. The owner-role refinement is added with the
    // admin shell (Phase 8), once the Clerk role claim is configured.
    await auth.protect();
  }
  return handleI18nRouting(req);
});

export const config = {
  // Skip API routes, Next internals, and files with an extension (assets).
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
