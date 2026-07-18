/**
 * Clerk widget theming, shared by every `ClerkProvider` (client site + admin
 * are separate root layouts, each with its own provider). One constant so the
 * brand treatment can't drift between them. Stable module reference so it never
 * changes across renders (Clerk re-inits on a new appearance object).
 *
 * Uses the built-in `variables` API rather than the @clerk/ui bundle, which
 * stalled/blanked on locale-triggered re-inits.
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: "#121212", // Onyx CTA
    borderRadius: "0.125rem", // ~2px, matches the squared brand radius
    fontFamily: "var(--font-jakarta), sans-serif",
  },
} as const
