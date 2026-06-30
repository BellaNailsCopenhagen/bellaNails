import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

/**
 * Next 16 renamed the `middleware` convention to `proxy` (Node runtime only).
 * next-intl's middleware is a plain (request) => response function, so we
 * re-export it as `proxy`: it negotiates the locale and redirects `/` → `/da`.
 */
export const proxy = createMiddleware(routing);

export const config = {
  // Run on everything except API routes, Next internals, and files with an
  // extension (assets). This keeps locale handling off static/_next paths.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
