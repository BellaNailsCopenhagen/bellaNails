import type { MetadataRoute } from "next"

import { disallowedPaths } from "@/config/routes"
import { isProductionSite, SITE_URL } from "@/config/site"

/**
 * What a crawler may look at. Both files were 404 until now, so the studio's
 * own tool and every client's signed link were as crawlable as the menu.
 *
 * `noindex` on a page asks politely to be forgotten after being fetched; a
 * disallow here means never fetched at all, which is what a one-client link
 * deserves. Both are worth having: this file is public, so it is also a list of
 * where to look — hence prefixes rather than the tokens themselves.
 */
export default function robots(): MetadataRoute.Robots {
  // A staging or preview deploy is a complete copy of the site on another
  // host. Letting it be crawled is how a test domain ends up outranking the
  // real one for the studio's own name.
  if (!isProductionSite()) {
    return { rules: { userAgent: "*", disallow: "/" } }
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: disallowedPaths,
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
