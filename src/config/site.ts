import type { Metadata } from "next"

import { routing } from "@/i18n/routing"

/** Canonical site origin, trailing-slash-normalized. One constant so the
    layout metadata and URLs baked into emails can never disagree. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://bellanails.dk"
).replace(/\/+$/, "")

/**
 * The absolute URL of one public path in one locale.
 *
 * Every locale is prefixed (`localePrefix: "always"`), so the home page is
 * `/da`, not `/`. Getting that wrong is how a canonical ends up pointing at a
 * redirect.
 */
export function localeUrl(locale: string, path: string): string {
  return `${SITE_URL}/${locale}${path === "/" ? "" : path}`
}

/**
 * `canonical` + `hreflang` for one public path, for a page's `metadata`.
 *
 * Without it /da and /en are two URLs carrying the same offering in different
 * words, and a crawler is entitled to read that as duplicate content and pick
 * one itself. The self-canonical says "this URL is the real one", and the
 * `languages` map says "and that one is the same page in the other language".
 *
 * `x-default` is Danish: this is a Copenhagen studio and Danish is the market
 * default, so a visitor whose language we don't serve should land there.
 */
export function alternatesFor(
  locale: string,
  path: string,
): Metadata["alternates"] {
  const languages: Record<string, string> = {}
  for (const supported of routing.locales) {
    languages[supported] = localeUrl(supported, path)
  }
  languages["x-default"] = localeUrl(routing.defaultLocale, path)
  return { canonical: localeUrl(locale, path), languages }
}
