"use client"

import { useLocale } from "next-intl"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

import { Link, usePathname } from "@/i18n/navigation"
import { routing } from "@/i18n/routing"
import { cn } from "@/shared/cn"

// Two-letter labels for the square toggle (comp shows EN / DK for Danish).
const SHORT: Record<string, string> = { en: "EN", da: "DK" }

/**
 * The pair of links. Square EN/DK switch matching the comp: active locale
 * filled Onyx, the other outlined. Each is a real locale-aware <Link> (works
 * without JS, no flash); `usePathname()` returns the path without the locale
 * prefix so the current page is preserved across locales.
 */
function Toggle({
  className,
  search,
}: {
  className?: string
  /** Encoded query to carry over, or "" when it isn't known yet. */
  search: string
}) {
  const active = useLocale()
  const pathname = usePathname()
  const href = search ? `${pathname}?${search}` : pathname

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {routing.locales.map((locale) => {
        const isActive = locale === active
        return (
          <Link
            key={locale}
            href={href}
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

function ToggleWithQuery({ className }: { className?: string }) {
  // Mid-checkout the query IS the page — chosen service, add-ons, step, the
  // details already typed. `usePathname()` is pathname-only, so carry the
  // search string too or switching language restarts the booking.
  const search = useSearchParams().toString()
  return <Toggle className={className} search={search} />
}

/**
 * LocaleToggle — the header's language switch.
 *
 * `useSearchParams()` opts a page out of prerendering, and six public pages are
 * static, so the query-aware pair renders inside Suspense with the plain pair as
 * the prerendered fallback. Nothing is lost either way: a static page has no
 * query, and the pages where the query matters (/book, /confirmation,
 * /appointments) are dynamic and render it server-side.
 */
function LocaleToggle({ className }: { className?: string }) {
  return (
    <Suspense fallback={<Toggle className={className} search="" />}>
      <ToggleWithQuery className={className} />
    </Suspense>
  )
}

export { LocaleToggle }
