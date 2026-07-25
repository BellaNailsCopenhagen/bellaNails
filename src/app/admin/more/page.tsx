import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowUpRight,
  BarChart3,
  CalendarRange,
  ChevronRight,
  ExternalLink,
  Images,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { H2 } from "@/components/ui/typography"
import { CALCOM_ORIGIN } from "@/config/calcom"

export const metadata: Metadata = { title: "More" }

type MoreItem = {
  label: string
  description: string
  icon: LucideIcon
  /** Internal route, external URL, or neither (a not-yet-built entry). */
  href?: string
  external?: boolean
  soon?: boolean
}

// The hub for everything that isn't a primary tab. Availability stays in Cal
// (owner decision); gallery + insights are planned (Tasks 04, 10).
const ITEMS: MoreItem[] = [
  {
    label: "Appointments",
    description: "Full history, filters, and past bookings",
    icon: CalendarRange,
    href: "/admin/appointments",
  },
  {
    label: "Booking calendar",
    description: "Manage availability and schedule in Cal.com",
    icon: ExternalLink,
    href: CALCOM_ORIGIN,
    external: true,
  },
  {
    label: "Gallery & testimonials",
    description: "Curate the public gallery and reviews",
    icon: Images,
    soon: true,
  },
  {
    label: "Insights",
    description: "Income and occupancy at a glance",
    icon: BarChart3,
    soon: true,
  },
]

function ItemBody({ item }: { item: MoreItem }) {
  const Icon = item.icon
  return (
    <>
      <span className="flex min-w-0 items-center gap-3">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0">
          <span className="block font-functional text-sm text-foreground">
            {item.label}
          </span>
          <span className="block font-functional text-xs text-muted-foreground">
            {item.description}
          </span>
        </span>
      </span>
      {item.soon ? (
        <Badge variant="outline" size="xs">
          Soon
        </Badge>
      ) : item.external ? (
        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
      ) : (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      )}
    </>
  )
}

export default function AdminMorePage() {
  return (
    <div className="space-y-8">
      <H2>More</H2>

      <ul className="border-t border-border">
        {ITEMS.map((item) => (
          <li key={item.label} className="border-b border-border">
            {item.soon ? (
              <div className="flex items-center justify-between gap-3 py-3 opacity-60">
                <ItemBody item={item} />
              </div>
            ) : item.external ? (
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 py-3"
              >
                <ItemBody item={item} />
              </a>
            ) : (
              <Link
                href={item.href ?? "#"}
                className="flex items-center justify-between gap-3 py-3"
              >
                <ItemBody item={item} />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
