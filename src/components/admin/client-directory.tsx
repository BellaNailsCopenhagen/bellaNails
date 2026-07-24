"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { BodySm } from "@/components/ui/typography"
import { CollapsibleSection } from "@/components/admin/collapsible-section"
import { formatStudioDayMonthYear } from "@/lib/studio-time"
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
  /** Lower-cased name + email haystack, so search hits last name and email. */
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
            href={`/admin/clients/${client.id}`}
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
 * The client directory — every client who has ever booked, split into activated
 * (own account, contactable outside a booking) and booking-only collapsible
 * sections. Client-side search over name + email (the roster is small at studio
 * scale); when searching, both sections open so matches aren't hidden.
 */
export function ClientDirectory({ clients }: { clients: ClientRosterEntry[] }) {
  const [query, setQuery] = useState("")
  const [openActivated, setOpenActivated] = useState(true)
  const [openBookingOnly, setOpenBookingOnly] = useState(true)

  const { activated, bookingOnly, matches } = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matches = needle
      ? clients.filter((c) => c.search.includes(needle))
      : clients
    return {
      matches,
      activated: matches.filter((c) => c.activated),
      bookingOnly: matches.filter((c) => !c.activated),
    }
  }, [query, clients])

  const searching = query.trim().length > 0

  return (
    <div className="space-y-10">
      <Input
        type="search"
        placeholder="Search name or email"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search clients"
      />

      {searching && !matches.length ? (
        <EmptyState title="No matches" body="No client matches that search." />
      ) : (
        <div className="space-y-8">
          <CollapsibleSection
            label="Activated"
            count={activated.length}
            open={searching || openActivated}
            onToggle={() => setOpenActivated((o) => !o)}
          >
            <ClientRows clients={activated} />
          </CollapsibleSection>

          <CollapsibleSection
            label="Booking-only"
            count={bookingOnly.length}
            open={searching || openBookingOnly}
            onToggle={() => setOpenBookingOnly((o) => !o)}
          >
            <ClientRows clients={bookingOnly} />
          </CollapsibleSection>
        </div>
      )}
    </div>
  )
}
