/**
 * Which origin is the real site — the rule behind every `noindex` decision.
 *
 * Everything SEO is built from `NEXT_PUBLIC_SITE_URL`: the sitemap, robots.txt,
 * and every page's self-canonical. So a staging deploy left unguarded publishes
 * a crawlable copy of the whole site that declares ITSELF canonical, and
 * competes with the real domain for the ranking it exists to earn. Staging says
 * no to crawlers instead.
 *
 * Pure and isomorphic, with no next-intl or env dependency, so the rule is
 * testable on its own — which matters, because the lookalike case below is the
 * kind of thing that regresses silently.
 */

/** The one host that may be indexed. */
export const PRODUCTION_HOST = "bellanails.dk"

/**
 * May this origin be indexed? `www` counts; a preview URL, `test.`, localhost
 * and a lookalike (`bellanails.dk.evil.example`) do not.
 *
 * Compared as a parsed hostname and never with `endsWith` — beating an
 * `endsWith` check is what a lookalike host is for.
 */
export function isIndexableOrigin(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return hostname === PRODUCTION_HOST || hostname === `www.${PRODUCTION_HOST}`
  } catch {
    return false
  }
}
