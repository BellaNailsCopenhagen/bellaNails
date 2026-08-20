"use client"

import Link from "next/link"
import { useLocale } from "next-intl"
import { Settings } from "lucide-react"

import { routes } from "@/config/routes"
import { useCurrentUser } from "@/lib/identity/use-current-user"

/**
 * Signed-in header control: a link to My space (profile, terms, sign out, delete
 * account). Renders nothing when signed out.
 */
export function AccountMenu() {
  const { user } = useCurrentUser()
  const locale = useLocale()
  if (!user) return null

  return (
    <Link
      href={`/${locale}${routes.account}`}
      aria-label="My space"
      title="My space"
      className="flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
    >
      <Settings className="size-4" />
    </Link>
  )
}
