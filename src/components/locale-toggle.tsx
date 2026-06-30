"use client";

import { useLocale } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

/**
 * LocaleToggle — switches between locales while staying on the current page.
 *
 * Renders a real <Link> per locale (next-intl's locale-aware navigation), so
 * switching is a plain navigation: it works without JS and produces no client
 * flash. `usePathname()` here returns the path *without* the locale prefix, so
 * the same path is preserved across locales.
 */
function LocaleToggle({ className }: { className?: string }) {
  const active = useLocale();
  const pathname = usePathname();

  return (
    <div
      className={cn(
        "flex items-center gap-2 font-functional text-xs uppercase tracking-widest-lux",
        className,
      )}
    >
      {routing.locales.map((locale, i) => (
        <span key={locale} className="flex items-center gap-2">
          {i > 0 && <span className="text-border">/</span>}
          <Link
            href={pathname}
            locale={locale}
            aria-current={locale === active ? "true" : undefined}
            className={cn(
              "transition-colors",
              locale === active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {locale}
          </Link>
        </span>
      ))}
    </div>
  );
}

export { LocaleToggle };
