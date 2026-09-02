import {
  CalendarDays,
  Home,
  MoreHorizontal,
  Plus,
  User,
  type LucideIcon,
} from "lucide-react"

import { routes } from "@/shared/routes"

/**
 * Admin tab bar. **New is the centered action** (slot 3 of 5), so the visual
 * order is Today · Clients · New · Agenda · More.
 *
 * Slot 4 is the schedule, not the catalog: the artist looks at what is coming
 * up several times a day and edits a service every few weeks — Services moved
 * to More, where the rest of the infrequent settings live.
 *
 * The admin is English-only and not locale-prefixed, so these are plain
 * absolute paths used with `next/link`.
 */
export type AdminTab = {
  href: string
  label: string
  icon: LucideIcon
  /** Centered emphasized action (studio-created booking). */
  primary?: boolean
}

export const adminTabs: AdminTab[] = [
  { href: routes.admin.home, label: "Today", icon: Home },
  { href: routes.admin.clients, label: "Clients", icon: User },
  { href: routes.admin.newBooking(), label: "New", icon: Plus, primary: true },
  { href: routes.admin.agenda, label: "Agenda", icon: CalendarDays },
  { href: routes.admin.more, label: "More", icon: MoreHorizontal },
]

/** Is `tab` the active one for the current pathname? /admin matches exactly;
    the others match their subtree so nested pages keep the tab lit. */
export function isTabActive(tab: AdminTab, pathname: string): boolean {
  if (tab.href === routes.admin.home) return pathname === routes.admin.home
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`)
}
