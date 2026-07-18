import {
  AlignLeft,
  List,
  MoreHorizontal,
  Plus,
  User,
  type LucideIcon,
} from "lucide-react"

/**
 * Admin tab bar. Per the design's rendered bottom bar, **New is the centered
 * action** (slot 3 of 5), so the visual order is Queue · Clients · New ·
 * Services · More (the brief lists New 2nd by *priority*, but it renders
 * centered). Only Queue (the dashboard at /admin) is live in Task 01; the rest
 * route to in-shell "coming soon" placeholders that later tasks fill in.
 *
 * Icons match the design mock (Queue = list, Clients = single person, New =
 * plus, Services = lines, More = dots). The admin is English-only and not
 * locale-prefixed, so these are plain absolute paths used with `next/link`.
 */
export type AdminTab = {
  href: string
  label: string
  icon: LucideIcon
  /** Centered emphasized action (studio-created booking). */
  primary?: boolean
}

export const adminTabs: AdminTab[] = [
  { href: "/admin", label: "Queue", icon: List },
  { href: "/admin/clients", label: "Clients", icon: User },
  { href: "/admin/new", label: "New", icon: Plus, primary: true },
  { href: "/admin/services", label: "Services", icon: AlignLeft },
  { href: "/admin/more", label: "More", icon: MoreHorizontal },
]

/** Is `tab` the active one for the current pathname? /admin matches exactly;
    the others match their subtree so nested pages keep the tab lit. */
export function isTabActive(tab: AdminTab, pathname: string): boolean {
  if (tab.href === "/admin") return pathname === "/admin"
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`)
}
