"use client"

import { useMemo, useState } from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/shared/cn"
import { Eyebrow } from "@/components/ui/typography"
import {
  ALL_BOOKING_STATES,
  StatusFilter,
} from "@/components/admin/status-filter"
import { BookingListRow } from "@/components/admin/booking-list-row"
import {
  CalendarView,
  type DayStateCounts,
} from "@/components/admin/calendar-view"
import {
  groupBookingsByMonth,
  groupBookingsByWeek,
  studioMonthKey,
} from "@/shared/booking-agenda"
import {
  type DisplayBooking,
} from "@/shared/booking-view"
import {
  bookingState,
  type BookingState,
} from "@/shared/booking-policy"
import type { ClientContact } from "@/shared/contact"
import {
  dayNumberToMs,
  formatStudioDayMonthYear,
  formatStudioMonthYear,
  studioDayNumber,
  studioWeekStartDayNumber,
} from "@/shared/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"

type ViewMode = "all" | "weekly" | "monthly"

const MODES: [ViewMode, string][] = [
  ["all", "All"],
  ["weekly", "Weekly"],
  ["monthly", "Monthly"],
]

type Layout = "list" | "calendar"

const LAYOUTS: [Layout, string][] = [
  ["list", "List"],
  ["calendar", "Calendar"],
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
 * The Appointments browse: List or Calendar, a status filter over both, and — in
 * the list — an All / Weekly / Monthly granularity toggle rendering collapsible
 * sections of condensed rows that expand to the full card. Switching granularity
 * resets collapse to that mode's defaults.
 *
 * The calendar is for finding a day, so picking one drops back to the list
 * narrowed to it: a month grid is the fastest way to remember WHEN something
 * was, and the list is the only place the appointment can actually be worked on.
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
  const [layout, setLayout] = useState<Layout>("list")
  const [monthOffset, setMonthOffset] = useState(0)
  // A single day picked off the calendar, as a studio day number.
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [states, setStates] = useState<Set<BookingState>>(
    () => new Set(ALL_BOOKING_STATES),
  )
  // Keys the user toggled away from their default open/closed state.
  const [overrides, setOverrides] = useState<Set<string>>(new Set())

  const byStatus = useMemo(
    () => bookings.filter((b) => states.has(bookingState(b.row, now))),
    [bookings, states, now],
  )

  const sections = useMemo(() => {
    const filtered =
      selectedDay == null
        ? byStatus
        : byStatus.filter((b) => studioDayNumber(startMs(b)) === selectedDay)
    return buildSections(mode, filtered, now)
  }, [mode, byStatus, selectedDay, now])

  // Per-day composition for the calendar, honouring the status filter so the
  // two views can never disagree about what is there.
  const dayCounts = useMemo(() => {
    const counts = new Map<number, DayStateCounts>()
    for (const booking of byStatus) {
      const day = studioDayNumber(startMs(booking))
      const perState = counts.get(day) ?? {}
      const state = bookingState(booking.row, now)
      perState[state] = (perState[state] ?? 0) + 1
      counts.set(day, perState)
    }
    return counts
  }, [byStatus, now])

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
  // A picked day narrows the list to one thing she asked for, so it opens. Past
  // and Future default to collapsed, which otherwise meant tapping a day in the
  // calendar landed on a lone closed header and looked like nothing was there.
  const isOpen = (section: Section) =>
    selectedDay != null ||
    (overrides.has(section.key) ? !section.defaultOpen : section.defaultOpen)
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
        <div className="flex flex-wrap items-center gap-3">
          <Segmented options={LAYOUTS} value={layout} onChange={setLayout} />
          {layout === "list" ? (
            <Segmented options={MODES} value={mode} onChange={switchMode} />
          ) : null}
        </div>
        <StatusFilter selected={states} onToggle={toggleState} />
      </div>

      {/* A day picked off the calendar narrows the list until it is cleared —
          shown as a chip so the list can never look mysteriously short. */}
      {selectedDay != null ? (
        <button
          type="button"
          onClick={() => setSelectedDay(null)}
          className="flex items-center gap-2 self-start rounded-full border border-border px-3 py-1 font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
        >
          {formatStudioDayMonthYear(dayNumberToMs(selectedDay), ADMIN_LOCALE)}
          <span aria-hidden>×</span>
          <span className="sr-only">Show every day again</span>
        </button>
      ) : null}

      {layout === "calendar" ? (
        <CalendarView
          dayCounts={dayCounts}
          now={now}
          offset={monthOffset}
          onOffsetChange={setMonthOffset}
          onSelectDay={(day) => {
            setSelectedDay(day)
            setOverrides(new Set())
            setLayout("list")
          }}
        />
      ) : null}

      {layout === "calendar" ? null : sections.length === 0 ? (
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
                        key={booking.row.id}
                        booking={booking}
                        contact={contacts[booking.row.client_id]}
                        clientNoShowCount={noShowCounts[booking.row.client_id]}
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
