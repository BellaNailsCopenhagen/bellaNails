"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { BodySm } from "@/components/ui/typography"
import { TabBar } from "@/components/ui/tab-bar"
import { matchesClientSearch } from "@/shared/client-search"
import { routes } from "@/shared/routes"
import { formatStudioDayMonthYear } from "@/shared/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"

export type ClientRosterEntry = {
  id: string
  name: string
  /** The client has signed into their own account (vs booking-only). */
  activated: boolean
  /** Total bookings. */
  count: number
  /** Most recent past appointment (ms), or null if they've only booked ahead. */
  lastVisitMs: number | null
  /** Lower-cased name + email + digits-only phone haystack (see client-search). */
  search: string
}

function caption(entry: ClientRosterEntry): string {
  const bookings = `${entry.count} booking${entry.count === 1 ? "" : "s"}`
  if (entry.lastVisitMs === null) return `${bookings} · upcoming`
  return `${bookings} · last ${formatStudioDayMonthYear(entry.lastVisitMs, ADMIN_LOCALE)}`
}

function ClientRows({ clients }: { clients: ClientRosterEntry[] }) {
  if (!clients.length) {
    return <BodySm className="py-2">None.</BodySm>
  }
  return (
    <ul className="border-t border-border">
      {clients.map((client) => (
        <li key={client.id} className="border-b border-border">
          <Link
            href={routes.admin.client(client.id)}
            className="flex items-center justify-between gap-3 py-3"
          >
            <div className="min-w-0">
              <p className="truncate font-functional text-sm text-foreground">
                {client.name}
              </p>
              <p className="font-functional text-xs text-muted-foreground">
                {caption(client)}
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

/**
 * The client directory — every client who has ever booked, split by whether
 * they've activated their own account (Active = reachable outside a booking) or
 * are booking-only. Tabs with counts + a one-line explanation each; client-side
 * search over name, phone + email (the roster is small at studio scale).
 */
type ClientTab = "active" | "booking-only"

const TAB_HELP: Record<ClientTab, string> = {
  active: "Signed into their own account — fine to contact outside a booking.",
  "booking-only": "Account created from a booking — contact for appointment matters only.",
}

export function ClientDirectory({ clients }: { clients: ClientRosterEntry[] }) {
  const [query, setQuery] = useState("")
  const [tab, setTab] = useState<ClientTab>("active")

  const { activated, bookingOnly } = useMemo(() => {
    const matches = clients.filter((c) => matchesClientSearch(c.search, query))
    return {
      activated: matches.filter((c) => c.activated),
      bookingOnly: matches.filter((c) => !c.activated),
    }
  }, [query, clients])

  const shown = tab === "active" ? activated : bookingOnly

  return (
    <div className="space-y-6">
      <Input
        type="search"
        placeholder="Search name, phone, or email"
        value={query}
        onValueChange={setQuery}
        aria-label="Search clients"
      />

      <TabBar
        tabs={[
          { value: "active", label: "Active", count: activated.length },
          {
            value: "booking-only",
            label: "Booking-only",
            count: bookingOnly.length,
          },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="space-y-2 pl-2">
        <BodySm className="text-xs">{TAB_HELP[tab]}</BodySm>
        {shown.length ? (
          <ClientRows clients={shown} />
        ) : (
          <EmptyState
            title="No clients"
            body={
              query
                ? "No client matches that search."
                : "No clients in this group yet."
            }
          />
        )}
      </div>
    </div>
  )
}
