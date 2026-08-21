"use client"

import * as React from "react"

import { cn } from "@/shared/cn"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { TintedCard } from "@/components/ui/tinted-card"
import { BodySm, Caption } from "@/components/ui/typography"
import type { Slot } from "@/shared/booking-slots"
import {
  formatStudioDate,
  formatStudioTime,
  studioDayNumber,
} from "@/shared/studio-time"

export type SlotPickerOutcome = { ok: true } | { ok: false; error: string }

export type SlotPickerLabels = {
  chooseDate: string
  chooseTime: string
  empty: string
  confirm: string
  confirming: string
  genericError: string
}

type DayGroup = { dayNumber: number; label: string; slots: Slot[] }

/** Group UTC-ISO slots by studio day, preserving generation order. */
function groupByDay(slots: Slot[], locale: string): DayGroup[] {
  const groups = new Map<number, DayGroup>()
  for (const slot of slots) {
    const day = studioDayNumber(new Date(slot.start).getTime())
    const group = groups.get(day)
    if (group) group.slots.push(slot)
    else
      groups.set(day, {
        dayNumber: day,
        label: formatStudioDate(slot.start, locale),
        slots: [slot],
      })
  }
  return [...groups.values()]
}

/**
 * The in-house date + time picker shared by the /book confirm step and both
 * reschedule flows. Presentational + selection state only: the caller supplies
 * pre-fetched slots, its own copy (so it works in the localized client flow and
 * the English admin alike), and an `onConfirm` that owns the mutation and the
 * navigation. On a failed confirm the picker surfaces the error and stays put.
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
  const days = React.useMemo(() => groupByDay(slots, locale), [slots, locale])
  const [activeDay, setActiveDay] = React.useState(
    () => days[0]?.dayNumber ?? null,
  )
  const [selected, setSelected] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()

  if (days.length === 0) {
    return (
      <TintedCard>
        <BodySm>{labels.empty}</BodySm>
      </TintedCard>
    )
  }

  const currentDay = days.find((d) => d.dayNumber === activeDay) ?? days[0]

  const confirm = () => {
    if (!selected) return
    startTransition(async () => {
      setError(null)
      const result = await onConfirm(selected)
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
        <div className="flex flex-wrap gap-2">
          {days.map((day) => (
            <button
              key={day.dayNumber}
              type="button"
              onClick={() => {
                setActiveDay(day.dayNumber)
                setSelected(null)
              }}
              aria-pressed={day.dayNumber === currentDay.dayNumber}
              className={cn(
                "rounded-sm border px-3 py-2 font-functional text-xs transition-colors",
                day.dayNumber === currentDay.dayNumber
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {day.label}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <Caption className="block text-[10px] tracking-widest-lux">
          {labels.chooseTime}
        </Caption>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {currentDay.slots.map((slot) => (
            <button
              key={slot.start}
              type="button"
              onClick={() => setSelected(slot.start)}
              aria-pressed={selected === slot.start}
              className={cn(
                "rounded-sm border px-3 py-2 font-functional text-sm tabular-nums transition-colors",
                selected === slot.start
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

      <Button
        size="lg"
        disabled={!selected || pending}
        onClick={confirm}
      >
        {pending ? labels.confirming : labels.confirm}
      </Button>
    </div>
  )
}
