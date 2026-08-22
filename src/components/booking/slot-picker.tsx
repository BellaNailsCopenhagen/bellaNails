"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/shared/cn"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { TintedCard } from "@/components/ui/tinted-card"
import { BodySm, Caption } from "@/components/ui/typography"
import type { Slot } from "@/shared/booking-slots"
import {
  dayNumberToMs,
  formatStudioDate,
  formatStudioDayMonthYear,
  formatStudioMonthYear,
  formatStudioTime,
  formatStudioWeekdayShort,
  studioDayNumber,
  studioDayNumberForDate,
  studioYearMonth,
} from "@/shared/studio-time"

export type SlotPickerOutcome = { ok: true } | { ok: false; error: string }

export type SlotPickerLabels = {
  chooseDate: string
  chooseTime: string
  empty: string
  confirm: string
  confirming: string
  genericError: string
  /** Horizon note, e.g. "You can book up to 60 days in advance". */
  advanceNote: string
  /** Legend for the "day has open times" marker. */
  availableLegend: string
  /** Month-nav aria-labels (screen readers). */
  prevMonth: string
  nextMonth: string
}

const WEEKDAYS = 7
// Monday-based weekday index of a studio day-number (epoch day 0 was a Thursday).
const weekdayIndex = (dayNumber: number) => (dayNumber + 3) % WEEKDAYS
const monthKey = (ym: { year: number; month: number }) => ym.year * 12 + ym.month

/**
 * The in-house date + time picker shared by the /book confirm step and both
 * reschedule flows. Presentational + selection state only: the caller supplies
 * pre-fetched slots, its own localized copy, and an `onConfirm` that owns the
 * mutation + navigation. The date side is a month calendar — open days are
 * highlighted, everything else is inert — and the first open day + its first
 * time are preselected so the flow is one tap from bookable. On a failed
 * confirm the picker surfaces the error and stays put.
 */
export function SlotPicker({
  slots,
  locale,
  onConfirm,
  labels,
}: {
  slots: Slot[]
  locale: string
  onConfirm: (startIso: string) => Promise<SlotPickerOutcome>
  labels: SlotPickerLabels
}) {
  // dayNumber → that day's slots (generation order); days ascending.
  const byDay = React.useMemo(() => {
    const map = new Map<number, Slot[]>()
    for (const slot of slots) {
      const day = studioDayNumber(new Date(slot.start).getTime())
      const list = map.get(day)
      if (list) list.push(slot)
      else map.set(day, [slot])
    }
    return map
  }, [slots])

  const availableDays = React.useMemo(
    () => [...byDay.keys()].sort((a, b) => a - b),
    [byDay],
  )
  const firstDay = availableDays[0] ?? null

  const [selectedDay, setSelectedDay] = React.useState<number | null>(firstDay)
  const [selectedSlot, setSelectedSlot] = React.useState<string | null>(() =>
    firstDay != null ? (byDay.get(firstDay)?.[0]?.start ?? null) : null,
  )
  const [view, setView] = React.useState(() =>
    firstDay != null
      ? studioYearMonth(dayNumberToMs(firstDay))
      : { year: 1970, month: 1 },
  )
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()

  if (firstDay == null) {
    return (
      <TintedCard>
        <BodySm>{labels.empty}</BodySm>
      </TintedCard>
    )
  }

  // Bound navigation to the months that actually contain availability.
  const firstMonth = studioYearMonth(dayNumberToMs(firstDay))
  const lastMonth = studioYearMonth(
    dayNumberToMs(availableDays[availableDays.length - 1]),
  )
  const canPrev = monthKey(view) > monthKey(firstMonth)
  const canNext = monthKey(view) < monthKey(lastMonth)
  const shiftMonth = (delta: number) =>
    setView((v) => {
      const m = v.month - 1 + delta
      return { year: v.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 + 1 }
    })

  // The viewed month, laid out as leading blanks + each date.
  const firstOfMonth = studioDayNumberForDate(view.year, view.month, 1)
  const daysInMonth = new Date(Date.UTC(view.year, view.month, 0)).getUTCDate()
  const leadingBlanks = weekdayIndex(firstOfMonth)
  const mondayOfFirstWeek = firstOfMonth - leadingBlanks
  const weekdayHeaders = Array.from({ length: WEEKDAYS }, (_, i) =>
    formatStudioWeekdayShort(dayNumberToMs(mondayOfFirstWeek + i), locale),
  )

  const pickDay = (day: number) => {
    setSelectedDay(day)
    setSelectedSlot(byDay.get(day)?.[0]?.start ?? null)
    setError(null)
  }

  const currentSlots = selectedDay != null ? (byDay.get(selectedDay) ?? []) : []

  const confirm = () => {
    if (!selectedSlot) return
    startTransition(async () => {
      setError(null)
      const result = await onConfirm(selectedSlot)
      // On success the caller navigates away; only failure returns here.
      if (!result.ok) setError(result.error || labels.genericError)
    })
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Caption className="block text-[10px] tracking-widest-lux">
          {labels.chooseDate}
        </Caption>

        <div className="rounded-md border border-border p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              disabled={!canPrev}
              aria-label={labels.prevMonth}
              className={cn(
                "rounded-sm p-1.5 transition-colors",
                canPrev
                  ? "text-foreground hover:bg-muted"
                  : "cursor-default text-muted-foreground/30",
              )}
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="font-functional text-sm">
              {formatStudioMonthYear(dayNumberToMs(firstOfMonth), locale)}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              disabled={!canNext}
              aria-label={labels.nextMonth}
              className={cn(
                "rounded-sm p-1.5 transition-colors",
                canNext
                  ? "text-foreground hover:bg-muted"
                  : "cursor-default text-muted-foreground/30",
              )}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {weekdayHeaders.map((w, i) => (
              <div
                key={i}
                className="pb-1 text-center font-functional text-[10px] uppercase tracking-wider text-muted-foreground"
              >
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = firstOfMonth + i
              const available = byDay.has(day)
              const isSelected = day === selectedDay
              return (
                <button
                  key={day}
                  type="button"
                  disabled={!available}
                  onClick={() => pickDay(day)}
                  aria-pressed={isSelected}
                  aria-label={formatStudioDayMonthYear(dayNumberToMs(day), locale)}
                  className={cn(
                    "flex h-12 items-center justify-center rounded-sm font-functional text-sm transition-colors sm:h-14",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : available
                        ? "border border-primary/30 text-foreground hover:border-primary hover:bg-muted"
                        : "cursor-default text-muted-foreground/30",
                  )}
                >
                  {i + 1}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 rounded-[3px] border border-primary/40"
              aria-hidden
            />
            {labels.availableLegend}
          </span>
          <span>{labels.advanceNote}</span>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <Caption className="block text-[10px] tracking-widest-lux">
            {labels.chooseTime}
          </Caption>
          {currentSlots[0] ? (
            <span className="font-functional text-xs text-muted-foreground">
              {formatStudioDate(currentSlots[0].start, locale)}
            </span>
          ) : null}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {currentSlots.map((slot) => (
            <button
              key={slot.start}
              type="button"
              onClick={() => setSelectedSlot(slot.start)}
              aria-pressed={selectedSlot === slot.start}
              className={cn(
                "rounded-sm border px-3 py-2 font-functional text-sm tabular-nums transition-colors",
                selectedSlot === slot.start
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-foreground hover:border-primary",
              )}
            >
              {formatStudioTime(slot.start, locale)}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <BodySm className="text-destructive" role="alert">
          {error}
        </BodySm>
      ) : null}

      <Button size="lg" disabled={!selectedSlot || pending} onClick={confirm}>
        {pending ? labels.confirming : labels.confirm}
      </Button>
    </div>
  )
}
