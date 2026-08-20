"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { SignOutButton } from "@/components/auth/sign-out-button"

import { cn } from "@/shared/cn"
import { Button } from "@/components/ui/button"
import { adminTabs, isTabActive } from "@/app/admin/_components/admin-nav"
import { AdminReviewBanner } from "@/app/admin/_components/admin-review-banner"

// Desktop nav excludes the primary "New" action — on ≥md it's a dedicated
// button (top-right), not a tab. On mobile "New" stays the centered action in
// the bottom bar.
const navTabs = adminTabs.filter((tab) => !tab.primary)
const newTab = adminTabs.find((tab) => tab.primary)

/**
 * AdminShell — the admin PWA chrome: a compact top header and navigation
 * (bottom tab bar on mobile, top tabs on ≥md). No marketing SiteHeader/
 * SiteFooter; the admin is its own root layout. English-only, so copy is inline.
 *
 * Mobile-first per the design: primary navigation lives in thumb reach at the
 * bottom, with "New" as the centered raised action. On desktop, nav is the
 * top tabs and "New" is a separate primary button.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const NewIcon = newTab?.icon

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-4 px-4">
          <Link
            href="/admin"
            className="flex items-center gap-2.5"
            aria-label="Bella Nails Studio — queue"
          >
            <Image
              src="/brand/bella-nails-monogram.svg"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8"
            />
            <span className="font-functional text-[0.6875rem] uppercase tracking-widest-lux text-foreground/70">
              Studio
            </span>
          </Link>

          {/* Top tabs — ≥md only (mobile uses the bottom bar). "New" is not a
              tab here; it's the button on the right. */}
          <nav
            aria-label="Admin sections"
            className="hidden items-center gap-6 md:flex"
          >
            {navTabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={isTabActive(tab, pathname) ? "page" : undefined}
                className={cn(
                  "font-functional text-xs uppercase tracking-widest-lux transition-colors",
                  isTabActive(tab, pathname)
                    ? "text-foreground"
                    : "text-foreground/60 hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {newTab && NewIcon ? (
              <Button
                size="sm"
                nativeButton={false}
                render={<Link href={newTab.href} />}
                className="hidden md:inline-flex"
              >
                <NewIcon className="size-4" />
                {newTab.label}
              </Button>
            ) : null}
            <SignOutButton />
          </div>
        </div>
      </header>

      <AdminReviewBanner />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-8 md:pb-12">
        {children}
      </main>

      {/* Bottom tab bar — mobile primary navigation, in thumb reach. "New" is
          the centered raised action. Labels share one baseline (justify-end +
          pb) so the raised circle doesn't knock them out of line. */}
      <nav
        aria-label="Admin sections"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-md md:hidden"
      >
        <div className="mx-auto flex h-16 max-w-3xl items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
          {adminTabs.map((tab) => {
            const active = isTabActive(tab, pathname)
            const Icon = tab.icon

            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center justify-end gap-1.5 pb-2 transition-colors",
                  tab.primary
                    ? "text-foreground"
                    : active
                      ? "text-foreground"
                      : "text-foreground/55",
                )}
              >
                {tab.primary ? (
                  <span className="-mt-7 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-[6px] ring-background">
                    <Icon className="size-6" />
                  </span>
                ) : (
                  <Icon className="size-5" />
                )}
                <span className="font-functional text-[0.625rem] uppercase leading-none tracking-widest-lux">
                  {tab.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
