import "server-only"

import { revalidatePath } from "next/cache"

import { routing } from "@/i18n/routing"
import { revalidatePatterns, routes } from "@/shared/routes"

/**
 * The prerendered public pages, per locale — `localePrefix` is always, so each
 * locale is its own cache entry and missing one serves stale HTML silently.
 *
 * Domain-neutral on purpose: the home page carries the showcase, the gallery
 * preview AND the testimonials, so three domains were each keeping their own
 * copy of this list and a fourth surface would have been wired into one.
 */
export function revalidateLocaleHomes(): void {
  for (const locale of routing.locales) {
    revalidatePath(routes.public.localeHome(locale))
  }
}

/**
 * Everything under the public shell. The footer is in the `[locale]` layout, so
 * a change to the studio's contact address or social links is on EVERY
 * prerendered page — not just the ones that name it.
 */
export function revalidatePublicShell(): void {
  revalidatePath(revalidatePatterns.publicLayout, "layout")
}

/** The home page plus /gallery — everything that renders placed client work. */
export function revalidatePublicSurfaces(): void {
  for (const locale of routing.locales) {
    revalidatePath(routes.public.localeHome(locale))
    revalidatePath(routes.public.gallery(locale))
  }
}
