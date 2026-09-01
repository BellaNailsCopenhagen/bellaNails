import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

/**
 * Hosts `next/image` may load from. Derived from the Supabase URL so the project
 * ref is configured in ONE place.
 *
 * ⚠️ next/image THROWS on an unconfigured hostname — it does not degrade. So a
 * build without NEXT_PUBLIC_SUPABASE_URL will render, but every page showing a
 * published image errors at request time. Same trap applies to removing the
 * legacy Scaleway var below while rows still reference that bucket.
 */
type Patterns = NonNullable<NextConfig["images"]>["remotePatterns"]

/**
 * Published media, served from the project's public bucket. Derived from the
 * Supabase URL so the project ref is configured in ONE place.
 *
 * ⚠️ next/image THROWS on an unconfigured hostname — it does not degrade. So if
 * this ever returns nothing, every page showing a published image errors at
 * request time rather than rendering without it.
 */
function imagePatterns(): Patterns {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return []
  try {
    return [
      {
        protocol: "https",
        hostname: new URL(url).hostname,
        // The public bucket only — private objects are read through short-lived
        // signed URLs and rendered with a plain <img>.
        pathname: "/storage/v1/object/public/media-public/**",
      },
    ]
  } catch {
    return []
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: imagePatterns(),
    /**
     * Supabase Storage serves objects with `Cache-Control: max-age=3600`, and
     * the optimizer keeps a variant for whichever is LARGER — that header or
     * this. One hour is exactly the "value is very low" case the Next docs warn
     * about: without this, every variant is re-fetched from the origin hourly,
     * and origin egress starts tracking visitors instead of variants.
     *
     * Safe to set long because a published key is immutable — `publishToPublic`
     * mints a fresh uuid per publish, so a given URL's bytes never change. A
     * takedown deletes the object and its row; an already-cached edge variant is
     * the ordinary CDN eventuality, which no origin design avoids.
     */
    minimumCacheTTL: 2_678_400, // 31 days
  },
};

// Points the plugin at our request config so getTranslations/useTranslations
// resolve messages per request. Path is explicit (default would be ./i18n).
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
