import { notFound } from "next/navigation"

/**
 * Catch-all for unknown paths under a locale.
 *
 * Next only renders the nested `[locale]/not-found.tsx` (with our header/footer
 * and the active locale) when `notFound()` is triggered *inside* the `[locale]`
 * segment. An unmatched URL on its own would fall through to the bare root
 * `app/not-found.tsx` instead. This catch-all matches any otherwise-unknown
 * slug under `/da` or `/en` and calls `notFound()`, so `/da/anything` lands on
 * the branded, localized 404. More specific routes (e.g. `/da/services`) always
 * win over this catch-all.
 */
export default function CatchAllNotFound() {
  notFound()
}
