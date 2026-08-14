/**
 * Feature flags — the single place to turn optional surfaces on/off.
 *
 * `base: true`  → core to the studio; always on (listed for completeness).
 * `base: false` → optional; flip `enabled` to hide the surface with no other
 *                 code change. An env override wins when set:
 *                 `NEXT_PUBLIC_FEATURE_<KEY_UPPER>=off` (or `on`).
 *
 * Read with `feature("key")` in a component/page; gate the surface on it.
 * Wiring is incremental — a flag only takes effect where it's actually checked.
 */
export const FEATURES = {
  // ── Base: the core booking + client experience ────────────────────────────
  booking: { enabled: true, base: true },
  appointments: { enabled: true, base: true },
  clientConsent: { enabled: true, base: true },
  terms: { enabled: true, base: true },
  adminCatalog: { enabled: true, base: true },

  // ── Optional: surfaces the owner may or may not want ──────────────────────
  serviceDetail: { enabled: true, base: false }, // /services/[id] + content sections
  serviceGallery: { enabled: true, base: false }, // consented client photos on service pages
  homeShowcase: { enabled: true, base: false }, // "recent client work" on the home page
  reviews: { enabled: true, base: false }, // per-service studio-entered reviews
  testimonials: { enabled: false, base: false }, // separate global testimonials (not built yet)
  favorites: { enabled: true, base: false }, // artist favouriting of client photos
} as const

export type FeatureKey = keyof typeof FEATURES

/** Is a feature enabled? Env override (`NEXT_PUBLIC_FEATURE_<KEY>`) wins. */
export function feature(key: FeatureKey): boolean {
  const override =
    process.env[`NEXT_PUBLIC_FEATURE_${key.toUpperCase()}`]?.toLowerCase()
  if (override === "off" || override === "false") return false
  if (override === "on" || override === "true") return true
  return FEATURES[key].enabled
}
