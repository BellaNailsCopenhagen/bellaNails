"use client"

import { useLocale } from "next-intl"

import { Link, usePathname } from "@/i18n/navigation"
import { routing } from "@/i18n/routing"
import { cn } from "@/lib/utils"

// Two-letter labels for the square toggle (comp shows EN / DK for Danish).
const SHORT: Record<string, string> = { en: "EN", da: "DK" }

/**
 * LocaleToggle — square EN/DK switch matching the comp: active locale filled
 * Onyx, the other outlined. Each is a real locale-aware <Link> (works without
 * JS, no flash); `usePathname()` returns the path without the locale prefix so
 * the current page is preserved across locales.
 */
function LocaleToggle({ className }: { className?: string }) {
  const active = useLocale()
  const pathname = usePathname()

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {routing.locales.map((locale) => {
        const isActive = locale === active
        return (
          <Link
            key={locale}
            href={pathname}
            locale={locale}
            aria-label={locale}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "flex size-6 items-center justify-center border font-functional text-[11px] leading-none transition-colors",
              isActive
                ? "border-foreground bg-foreground text-background"
                : "border-border text-foreground hover:border-foreground",
            )}
          >
            {SHORT[locale] ?? locale.toUpperCase()}
          </Link>
        )
      })}
    </div>
  )
}

export { LocaleToggle }
