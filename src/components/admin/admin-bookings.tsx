"use client"

import { useMemo, useState } from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Eyebrow } from "@/components/ui/typography"
import {
  ALL_BOOKING_STATES,
  StatusFilter,
} from "@/components/admin/status-filter"
import { BookingListRow } from "@/components/admin/booking-list-row"
import {
  groupBookingsByMonth,
  groupBookingsByWeek,
  studioMonthKey,
} from "@/lib/admin/agenda"
import {
  bookingState,
  type BookingState,
  type DisplayBooking,
} from "@/lib/booking-display"
import type { ClientContact } from "@/lib/clerk/contact"
import {
  dayNumberToMs,
  formatStudioDayMonthYear,
  formatStudioMonthYear,
  studioDayNumber,
  studioWeekStartDayNumber,
} from "@/lib/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"

type ViewMode = "all" | "weekly" | "monthly"

const MODES: [ViewMode, string][] = [
  ["all", "All"],
  ["weekly", "Weekly"],
  ["monthly", "Monthly"],
]

type Section = {
  key: string
  label: string
  bookings: DisplayBooking[]
  defaultOpen: boolean
}

const startMs = (b: DisplayBooking) => new Date(b.row.start_time).getTime()
const endMs = (b: DisplayBooking) => new Date(b.row.end_time).getTime()

function weekLabel(offset: number, weekStartDay: number): string {
  if (offset === 0) return "Current week"
  if (offset === 1) return "Next week"
  if (offset === -1) return "Last week"
  return `Week of ${formatStudioDayMonthYear(dayNumberToMs(weekStartDay), ADMIN_LOCALE)}`
}

/** Sections for the chosen granularity. "All" = coarse Future / Current week /
    Past Appointments buckets; "Weekly"/"Monthly" = one section per period
    (most-recent first). Only non-empty sections are returned. */
function buildSections(
  mode: ViewMode,
  bookings: DisplayBooking[],
  now: number,
): Section[] {
  if (mode === "weekly") {
    return groupBookingsByWeek(bookings, now, "desc").map((w) => ({
      key: `w${w.weekStartDay}`,
      label: weekLabel(w.offset, w.weekStartDay),
      bookings: w.bookings,
      defaultOpen: w.offset === 0,
    }))
  }

  if (mode === "monthly") {
    const currentMonth = studioMonthKey(now)
    return groupBookingsByMonth(bookings, "desc").map((m) => ({
      key: `m${m.monthKey}`,
      label: formatStudioMonthYear(m.ms, ADMIN_LOCALE),
      bookings: m.bookings,
      defaultOpen: m.monthKey === currentMonth,
    }))
  }

  // "All": coarse buckets — Future / Current week / Past Appointments.
  const currentWeekStart = studioWeekStartDayNumber(studioDayNumber(now))
  const future: DisplayBooking[] = []
  const currentWeek: DisplayBooking[] = []
  const past: DisplayBooking[] = []
  for (const booking of bookings) {
    if (endMs(booking) < now) {
      past.push(booking)
      continue
    }
    const week = studioWeekStartDayNumber(studioDayNumber(startMs(booking)))
    if (week > currentWeekStart) future.push(booking)
    else currentWeek.push(booking)
  }
  future.sort((a, b) => startMs(a) - startMs(b))
  currentWeek.sort((a, b) => startMs(a) - startMs(b))
  past.sort((a, b) => startMs(b) - startMs(a))

  return [
    { key: "future", label: "Future", bookings: future, defaultOpen: false },
    {
      key: "current",
      label: "Current week",
      bookings: currentWeek,
      defaultOpen: true,
    },
    {
      key: "past",
      label: "Past Appointments",
      bookings: past,
      defaultOpen: false,
    },
  ].filter((section) => section.bookings.length > 0)
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: [T, string][]
  value: T
  onChange: (next: T) => void
}) {
  return (
    <div className="flex w-fit items-center gap-0.5 rounded-sm border border-border p-0.5">
      {options.map(([option, label]) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={cn(
            "rounded-[2px] px-3 py-1.5 font-functional text-[0.625rem] uppercase tracking-widest-lux transition-colors",
            value === option
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/**
 * The Appointments browse: an All / Weekly / Monthly granularity toggle plus a
 * status filter, rendering collapsible sections (divider + 40px between them)
 * of condensed rows that expand to the full card. Switching granularity resets
 * collapse to that mode's defaults (current period open, the rest collapsed).
 */
export function AdminBookings({
  bookings,
  contacts,
  noShowCounts,
  now,
  photosByBooking = {},
}: {
  bookings: DisplayBooking[]
  contacts: Record<string, ClientContact>
  noShowCounts: Record<string, number>
  now: number
  photosByBooking?: Record<string, { id: string; url: string; kind: string }[]>
}) {
  const [mode, setMode] = useState<ViewMode>("all")
  const [states, setStates] = useState<Set<BookingState>>(
    () => new Set(ALL_BOOKING_STATES),
  )
  // Keys the user toggled away from their default open/closed state.
  const [overrides, setOverrides] = useState<Set<string>>(new Set())

  const sections = useMemo(() => {
    const filtered = bookings.filter((b) => states.has(bookingState(b.row, now)))
    return buildSections(mode, filtered, now)
  }, [mode, states, bookings, now])

  const toggleState = (state: BookingState, checked: boolean) =>
    setStates((prev) => {
      const next = new Set(prev)
      if (checked) next.add(state)
      else next.delete(state)
      return next
    })

  const switchMode = (next: ViewMode) => {
    setMode(next)
    setOverrides(new Set())
  }
  const isOpen = (section: Section) =>
    overrides.has(section.key) ? !section.defaultOpen : section.defaultOpen
  const toggle = (key: string) =>
    setOverrides((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className="space-y-8">
      {/* Primary: the granularity view mode. Secondary: a compact status
          filter dropdown — the hierarchy (prominent segmented vs quiet
          dropdown) reads clearly and stays tidy on a phone. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented options={MODES} value={mode} onChange={switchMode} />
        <StatusFilter selected={states} onToggle={toggleState} />
      </div>

      {sections.length === 0 ? (
        <Eyebrow as="p" className="py-4 normal-case">
          No appointments match this filter.
        </Eyebrow>
      ) : (
        <div>
          {sections.map((section, index) => {
            const open = isOpen(section)
            return (
              <section key={section.key}>
                {/* Full-bleed hairline divider — a plain div (the Separator
                    component forces w-full, which can't extend past the admin
                    gutter). `-mx-4` negates the gutter; 40px above/below. */}
                {index > 0 ? (
                  <div aria-hidden className="-mx-4 my-10 h-px bg-border" />
                ) : null}
                <button
                  type="button"
                  onClick={() => toggle(section.key)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-3 pb-2 text-left"
                >
                  <Eyebrow as="span">{section.label}</Eyebrow>
                  <span className="flex items-center gap-3">
                    <span className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground">
                      {section.bookings.length}
                    </span>
                    <ChevronDown
                      className={cn(
                        "size-4 text-muted-foreground transition-transform",
                        open && "rotate-180",
                      )}
                    />
                  </span>
                </button>
                {open ? (
                  <ul>
                    {section.bookings.map((booking) => (
                      <BookingListRow
                        key={booking.row.cal_booking_id}
                        booking={booking}
                        contact={contacts[booking.row.clerk_user_id]}
                        clientNoShowCount={noShowCounts[booking.row.clerk_user_id]}
                        upcoming={endMs(booking) >= now}
                        now={now}
                        photos={photosByBooking[booking.row.id]}
                      />
                    ))}
                  </ul>
                ) : null}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
