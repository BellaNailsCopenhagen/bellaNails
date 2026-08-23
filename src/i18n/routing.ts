import { hasLocale } from "next-intl"
import { defineRouting } from "next-intl/routing"

/**
 * Locale routing config — the single source of truth shared by the proxy,
 * the navigation helpers, and the request config.
 *
 * Danish is the market default. `localePrefix: "always"` keeps both locales
 * explicitly prefixed (`/da`, `/en`) and lets the proxy redirect `/` → `/da`,
 * matching the plan's "/da (default) + /en" structure.
 */
export const routing = defineRouting({
  locales: ["da", "en"],
  defaultLocale: "da",
  localePrefix: "always",
})

export type Locale = (typeof routing.locales)[number]

/**
 * Narrow any candidate (a form value, a stored column, a URL segment) to a
 * supported `Locale`, falling back to the market default. The one place da/en
 * membership is decided — callers must never re-hardcode the pair inline.
 */
export function resolveLocale(value: string | null | undefined): Locale {
  return value != null && hasLocale(routing.locales, value)
    ? value
    : routing.defaultLocale
}
