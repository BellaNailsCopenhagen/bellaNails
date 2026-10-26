import type { MetadataRoute } from "next"

import { indexableRoutes, routes } from "@/config/routes"
import { localeUrl } from "@/config/site"
import { routing } from "@/i18n/routing"

/**
 * Both locales of every indexable page, each declaring the other through
 * hreflang.
 *
 * The hreflang pairs are the point as much as the list is: /da and /en carry
 * the same offering in different words, and without them a crawler is entitled
 * to treat one as a duplicate of the other and drop it.
 *
 * What is in here is decided in `config/routes.ts` — see `indexableRoutes` for
 * what is deliberately left out and why.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const languages = (path: string) => {
    const map: Record<string, string> = {}
    for (const locale of routing.locales) {
      map[locale] = localeUrl(locale, path)
    }
    map["x-default"] = localeUrl(routing.defaultLocale, path)

    return map
  }

  return routing.locales.flatMap((locale) =>
    indexableRoutes.map((path) => ({
      url: localeUrl(locale, path),
      alternates: { languages: languages(path) },
      // The home page is the entry point; everything else is one step in.
      priority: path === routes.home ? 1 : 0.7,
    })),
  )
}
