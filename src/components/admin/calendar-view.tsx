"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { addMonths, buildMonthGrid } from "@/lib/admin/calendar"
import {
  dayNumberToMs,
  formatStudioMonthYear,
  studioDayNumber,
  studioYearMonth,
} from "@/lib/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

const firstDayNumberOf = (year: number, month: number) =>
  Date.UTC(year, month - 1, 1) / 86_400_000

/**
 * Condensed month calendar — the high-level "plan ahead" glance. Same data as
 * the agenda (a day-number → count map derived from the fetched bookings), so
 * no separate fetch. Monday-start; today is ringed; days with bookings show a
 * quiet marker (dot for one, count for more) and are tappable to jump into the
 * agenda at that day. Empty days stay blank.
 *
 * Note: only upcoming bookings are loaded, so past months read as empty — this
 * is a forward planner, not a history browser.
 */
export function CalendarView({
  dayCounts,
  now,
  onSelectDay,
}: {
  dayCounts: Map<number, number>
  now: number
  onSelectDay: (dayNumber: number) => void
}) {
  const nowDay = studioDayNumber(now)
  const base = studioYearMonth(now)
  const [offset, setOffset] = useState(0)

  const { year, month } = addMonths(base.year, base.month, offset)
  const cells = buildMonthGrid(year, month)
  const monthLabel = formatStudioMonthYear(
    dayNumberToMs(firstDayNumberOf(year, month)),
    ADMIN_LOCALE,
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOffset((o) => o - 1)}
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
          onClick={() => setOffset((o) => o + 1)}
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
          if (dayNumber === null) return <div key={index} aria-hidden />

          const count = dayCounts.get(dayNumber) ?? 0
          const has = count > 0
          const isToday = dayNumber === nowDay
          const date = new Date(dayNumberToMs(dayNumber)).getUTCDate()

          return (
            <button
              key={index}
              type="button"
              disabled={!has}
              onClick={() => onSelectDay(dayNumber)}
              aria-label={`${date} — ${count} ${count === 1 ? "appointment" : "appointments"}`}
              className={cn(
                "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-sm border font-functional text-sm transition-colors",
                isToday ? "border-foreground" : "border-transparent",
                has
                  ? "cursor-pointer bg-muted/60 text-foreground hover:bg-muted"
                  : "text-muted-foreground/50",
              )}
            >
              <span>{date}</span>
              {count === 1 ? (
                <span className="size-1 rounded-full bg-primary" aria-hidden />
              ) : count > 1 ? (
                <span className="text-[0.5625rem] leading-none text-primary">
                  {count}
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
