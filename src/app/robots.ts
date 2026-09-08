import type { MetadataRoute } from "next"

import { disallowedPaths } from "@/config/routes"
import { SITE_URL } from "@/config/site"

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
