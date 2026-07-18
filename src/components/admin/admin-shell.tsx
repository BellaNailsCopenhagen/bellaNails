"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserButton } from "@clerk/nextjs"

import { cn } from "@/lib/utils"
import { adminTabs, isTabActive } from "@/components/admin/admin-nav"

/**
 * AdminShell — the admin PWA chrome: a compact top header and a tab bar
 * (bottom on mobile, top on ≥md). No marketing SiteHeader/SiteFooter; the
 * admin is its own root layout. English-only, so copy is inline.
 *
 * Mobile-first per the design brief: the artist works one-handed between
 * clients, so primary navigation lives in thumb reach at the bottom, and the
 * centered "New" action is emphasized.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

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

          {/* Top tabs — the ≥md enhancement; mobile uses the bottom bar. */}
          <nav
            aria-label="Admin sections"
            className="hidden items-center gap-6 md:flex"
          >
            {adminTabs.map((tab) => (
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

          <UserButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-8 md:pb-12">
        {children}
      </main>

      {/* Bottom tab bar — mobile primary navigation, in thumb reach. */}
      <nav
        aria-label="Admin sections"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-md md:hidden"
      >
        <div className="mx-auto flex h-16 max-w-3xl items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
          {adminTabs.map((tab) => {
            const active = isTabActive(tab, pathname)
            const Icon = tab.icon

            if (tab.primary) {
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className="flex flex-1 flex-col items-center justify-center gap-1"
                >
                  <span className="-mt-4 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                    <Icon className="size-5" />
                  </span>
                  <span className="font-functional text-[0.5625rem] uppercase tracking-widest-lux text-foreground/70">
                    {tab.label}
                  </span>
                </Link>
              )
            }

            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 transition-colors",
                  active ? "text-foreground" : "text-foreground/55",
                )}
              >
                <Icon className="size-5" />
                <span className="font-functional text-[0.5625rem] uppercase tracking-widest-lux">
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
