"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/shared/cn"
import {
  addMonths,
  buildMonthGrid,
  monthStartDayNumber,
} from "@/shared/month-grid"
import type { BookingState } from "@/shared/booking-policy"
import {
  dayNumberToMs,
  formatStudioMonthYear,
  studioDayNumber,
  studioYearMonth,
} from "@/shared/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

/** Per-day booking counts, split by state so a day's composition shows at a
    glance (a completed + a no-show read as two coloured marks). */
export type DayStateCounts = Partial<Record<BookingState, number>>

// Fixed order + colour per state. A single booking shows a coloured dot; more
// than one shows the coloured count.
const STATE_MARKERS = [
  ["open", "bg-primary", "text-primary"],
  ["completed", "bg-success", "text-success"],
  ["cancelled", "bg-muted-foreground", "text-muted-foreground"],
  ["no-show", "bg-destructive", "text-destructive"],
] as const satisfies readonly (readonly [BookingState, string, string])[]

const dayTotal = (counts: DayStateCounts) =>
  STATE_MARKERS.reduce((sum, [state]) => sum + (counts[state] ?? 0), 0)

/**
 * Condensed month calendar — a high-level glance over a day-number → count map
 * the caller supplies (no fetch of its own). Monday-start; today is ringed;
 * days with bookings show a quiet marker (dot for one, count for more). Which
 * months have data depends on the bookings passed: the queue loads only
 * upcoming (a forward planner), a client page passes full history (a pattern
 * view). Tappable only when `onSelectDay` is given; otherwise read-only.
 *
 * `offset` (months from the current one) is owned by the parent so the browsed
 * month survives toggling.
 */
export function CalendarView({
  dayCounts,
  now,
  offset,
  onOffsetChange,
  onSelectDay,
}: {
  dayCounts: Map<number, DayStateCounts>
  now: number
  offset: number
  onOffsetChange: (next: number) => void
  /** Omit for a read-only calendar (e.g. a client's pattern glance) — days
      then show their counts but aren't tappable. */
  onSelectDay?: (dayNumber: number) => void
}) {
  const interactive = Boolean(onSelectDay)
  const nowDay = studioDayNumber(now)
  const base = studioYearMonth(now)

  const { year, month } = addMonths(base.year, base.month, offset)
  const cells = buildMonthGrid(year, month)
  const monthLabel = formatStudioMonthYear(
    dayNumberToMs(monthStartDayNumber(year, month)),
    ADMIN_LOCALE,
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onOffsetChange(offset - 1)}
          aria-label="Previous month"
          className="flex size-9 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-5" />
        </button>
        <span className="font-editorial text-lg text-foreground">
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={() => onOffsetChange(offset + 1)}
          aria-label="Next month"
          className="flex size-9 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((weekday) => (
          <div
            key={weekday}
            className="text-center font-functional text-[0.5625rem] uppercase tracking-widest-lux text-muted-foreground"
          >
            {weekday}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((dayNumber, index) => {
          if (dayNumber === null) {
            return <div key={index} aria-hidden />
          }

          const counts = dayCounts.get(dayNumber) ?? {}
          const total = dayTotal(counts)
          const has = total > 0
          const isToday = dayNumber === nowDay
          const date = new Date(dayNumberToMs(dayNumber)).getUTCDate()

          return (
            <button
              key={index}
              type="button"
              disabled={!has || !interactive}
              onClick={onSelectDay ? () => onSelectDay(dayNumber) : undefined}
              aria-label={
                has
                  ? `${date} — ${total} ${total === 1 ? "appointment" : "appointments"}`
                  : String(date)
              }
              className={cn(
                "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-sm border font-functional text-sm transition-colors",
                isToday ? "border-foreground" : "border-transparent",
                has
                  ? "bg-muted/60 text-foreground"
                  : "text-muted-foreground/50",
                has && interactive && "cursor-pointer hover:bg-muted",
              )}
            >
              <span>{date}</span>
              {has ? (
                <span className="flex items-center justify-center gap-0.5">
                  {STATE_MARKERS.map(([state, dotClass, textClass]) => {
                    const n = counts[state] ?? 0
                    if (n === 0) {
                      return null
                    }

                    return n === 1 ? (
                      <span
                        key={state}
                        className={cn("size-1 rounded-full", dotClass)}
                        aria-hidden
                      />
                    ) : (
                      <span
                        key={state}
                        className={cn(
                          "text-[0.5625rem] leading-none",
                          textClass,
                        )}
                      >
                        {n}
                      </span>
                    )
                  })}
                </span>
              ) : (
                <span className="size-1" aria-hidden />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
