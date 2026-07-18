import {
  CalendarClock,
  MoreHorizontal,
  Plus,
  Scissors,
  Users,
  type LucideIcon,
} from "lucide-react"

/**
 * Admin tab bar — the information architecture from the design brief §3:
 * Queue · New · Clients · Services · More. "New" is the centered primary
 * action. Only Queue (the dashboard at /admin) is live in Task 01; the rest
 * route to in-shell "coming soon" placeholders that later tasks fill in.
 *
 * The admin is English-only and not locale-prefixed, so these are plain
 * absolute paths used with `next/link` (not the i18n-aware navigation).
 */
export type AdminTab = {
  href: string
  label: string
  icon: LucideIcon
  /** Centered emphasized action (studio-created booking). */
  primary?: boolean
}

export const adminTabs: AdminTab[] = [
  { href: "/admin", label: "Queue", icon: CalendarClock },
  { href: "/admin/new", label: "New", icon: Plus, primary: true },
  { href: "/admin/clients", label: "Clients", icon: Users },
  { href: "/admin/services", label: "Services", icon: Scissors },
  { href: "/admin/more", label: "More", icon: MoreHorizontal },
]

/** Is `tab` the active one for the current pathname? /admin matches exactly;
    the others match their subtree so nested pages keep the tab lit. */
export function isTabActive(tab: AdminTab, pathname: string): boolean {
  if (tab.href === "/admin") return pathname === "/admin"
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`)
}
