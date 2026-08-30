"use client"

import { useMemo, useState, type KeyboardEvent } from "react"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  SCHEDULE_KIND_LABEL,
  type Schedule,
  type ScheduleKind,
  type ScheduleRule,
} from "@/shared/schedule"
import {
  dayNumberForIso,
  isoForDayNumber,
  toMinutes,
  WEEKDAYS,
  weekdayIndexForDayNumber,
} from "@/shared/studio-hours"
import {
  dayNumberToMs,
  formatStudioDayMonthYear,
  formatStudioMonthYear,
  studioDayNumber,
} from "@/shared/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"

// No-work reads as grey diagonal stripes (theme-neutral rgba, renders in both).
// Light version for small swatches/chips; the denser HATCH is the week overlay
// drawn ON TOP of work blocks, with see-through gaps so the overlap stays visible.
const STRIPES = {
  backgroundImage:
    "repeating-linear-gradient(45deg, rgba(128,128,128,0.20) 0 4px, transparent 4px 8px)",
}
const HATCH = {
  backgroundImage:
    "repeating-linear-gradient(45deg, rgba(110,110,110,0.55) 0 3px, transparent 3px 7px)",
}

function blockClass(kind: ScheduleKind): string {
  if (kind === "standard") return "bg-primary/85 text-primary-foreground"
  if (kind === "outside")
    return "border border-dashed border-primary/60 bg-primary/15 text-foreground"
  return "border border-border text-muted-foreground"
}

const isAllDay = (r: ScheduleRule) => r.start === "00:00" && r.end === "23:59"

// Enter/Space activate a clickable (non-button) day container.
const activateOnKey = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault()
    fn()
  }
}

/** A `dayNumber → effective rules` lookup, grouping the schedule once (by weekday
    + by date) instead of scanning it for every one of the ~49 rendered cells. */
function useRulesForDay(schedule: Schedule) {
  return useMemo(() => {
    const byWeekday = new Map<number, ScheduleRule[]>()
    const byDate = new Map<string, ScheduleRule[]>()
    for (const r of schedule) {
      if (r.weekday !== null) {
        const list = byWeekday.get(r.weekday) ?? []
        list.push(r)
        byWeekday.set(r.weekday, list)
      } else if (r.onDate) {
        const list = byDate.get(r.onDate) ?? []
        list.push(r)
        byDate.set(r.onDate, list)
      }
    }
    return (dayNumber: number): ScheduleRule[] =>
      [
        ...(byWeekday.get(weekdayIndexForDayNumber(dayNumber)) ?? []),
        ...(byDate.get(isoForDayNumber(dayNumber)) ?? []),
      ].sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
  }, [schedule])
}

// ── Week view — a time-grid column per day ───────────────────────────────────
function DayColumn({
  dayNumber,
  rules,
  isToday,
  axisStart,
  axisSpan,
  onPick,
  onEdit,
}: {
  dayNumber: number
  rules: ScheduleRule[]
  isToday: boolean
  axisStart: number
  axisSpan: number
  onPick: (dayNumber: number) => void
  onEdit: (rule: ScheduleRule) => void
}) {
  const iso = isoForDayNumber(dayNumber)
  const weekday = weekdayIndexForDayNumber(dayNumber)
  return (
    // Whole column adds for the day; blocks stop propagation to edit instead.
    <div
      role="button"
      tabIndex={0}
      aria-label={`Add on ${iso}`}
      onClick={() => onPick(dayNumber)}
      onKeyDown={activateOnKey(() => onPick(dayNumber))}
      className="min-w-0 cursor-pointer rounded-sm"
    >
      <div className="mb-1 flex items-center justify-between gap-1 px-1 py-0.5">
        <span className="min-w-0">
          <span className="block font-functional text-[10px] uppercase tracking-widest-lux text-muted-foreground">
            {WEEKDAYS[weekday].label.slice(0, 3)}
          </span>
          <span
            className={
              isToday
                ? "inline-flex size-6 items-center justify-center rounded-full bg-primary font-functional text-xs font-semibold text-primary-foreground"
                : "font-functional text-sm text-muted-foreground"
            }
          >
            {Number(iso.slice(8, 10))}
          </span>
        </span>
        <Plus className="size-3.5 shrink-0 text-muted-foreground" />
      </div>
      <div className="relative h-72 overflow-hidden rounded-sm border border-border bg-muted/30">
        {[25, 50, 75].map((pct) => (
          <div
            key={pct}
            className="absolute inset-x-0 border-t border-border/40"
            style={{ top: `${pct}%` }}
          />
        ))}
        {rules.length === 0 ? (
          <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-functional text-[10px] text-muted-foreground/50">
            —
          </span>
        ) : null}
        {/* No-work renders LAST (on top): it wins the hierarchy, so its hatch must
            overlay any work block it covers — the gaps keep the overlap visible. */}
        {[...rules]
          .sort((a, b) => Number(a.kind === "no_work") - Number(b.kind === "no_work"))
          .map((rule) => {
          const top = ((toMinutes(rule.start) - axisStart) / axisSpan) * 100
          const height = ((toMinutes(rule.end) - toMinutes(rule.start)) / axisSpan) * 100
          return (
            <button
              key={rule.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(rule)
              }}
              style={{
                top: `${top}%`,
                height: `${Math.max(height, 6)}%`,
                ...(rule.kind === "no_work" ? HATCH : {}),
              }}
              className={`absolute inset-x-0.5 overflow-hidden rounded-[3px] px-1 py-0.5 text-left ${blockClass(rule.kind)}`}
            >
              <span className="block truncate font-functional text-[10px] leading-tight">
                {rule.start}–{rule.end}
              </span>
              {rule.label ? (
                <span className="block truncate text-[9px] opacity-80">
                  {rule.label}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Month view — a compact cell per day (tap cell = add, tap chip = edit) ─────
function MonthCell({
  dayNumber,
  rules,
  inMonth,
  isToday,
  onPick,
  onEdit,
}: {
  dayNumber: number
  rules: ScheduleRule[]
  inMonth: boolean
  isToday: boolean
  onPick: (dayNumber: number) => void
  onEdit: (rule: ScheduleRule) => void
}) {
  const iso = isoForDayNumber(dayNumber)
  return (
    // Whole cell adds for the day; chips stop propagation to edit instead.
    <div
      role="button"
      tabIndex={0}
      aria-label={`Add on ${iso}`}
      onClick={() => onPick(dayNumber)}
      onKeyDown={activateOnKey(() => onPick(dayNumber))}
      className={`flex min-h-16 cursor-pointer flex-col gap-0.5 rounded-sm border p-1 transition-colors hover:bg-muted ${
        isToday ? "border-primary ring-1 ring-primary" : "border-border"
      } ${inMonth ? "" : "opacity-40"}`}
    >
      <span
        className={
          isToday
            ? "inline-flex size-5 items-center justify-center self-start rounded-full bg-primary font-functional text-[11px] font-semibold text-primary-foreground"
            : "self-start px-0.5 font-functional text-xs text-muted-foreground"
        }
      >
        {Number(iso.slice(8, 10))}
      </span>
      {/* Every rule is an editable chip — no truncation, so nothing on a busy
          day is unreachable from month view (the cell just grows taller). */}
      {rules.map((rule) => (
        <button
          key={rule.id}
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onEdit(rule)
          }}
          style={rule.kind === "no_work" ? STRIPES : {}}
          className={`block truncate rounded-[2px] px-1 text-left text-[9px] leading-tight ${blockClass(rule.kind)}`}
        >
          {isAllDay(rule) ? "All day" : rule.start}
        </button>
      ))}
    </div>
  )
}

const LEGEND: ScheduleKind[] = ["standard", "outside", "no_work"]

/** A navigable calendar of the schedule, in a Week (time-grid) or Month view.
    Recurring rules show on every matching weekday; dated rules on their date.
    Tap a day → the stepper (add); tap a block/chip → edit it. No forward limit. */
export function ScheduleCalendar({
  schedule,
  now,
  onPickDay,
  onEditRule,
}: {
  schedule: Schedule
  now: number
  onPickDay: (dayNumber: number) => void
  onEditRule: (rule: ScheduleRule) => void
}) {
  const [view, setView] = useState<"week" | "month">("week")
  const today = studioDayNumber(now)
  const rulesForDay = useRulesForDay(schedule)

  // Week view state
  const thisWeekStart = today - weekdayIndexForDayNumber(today)
  const [weekOffset, setWeekOffset] = useState(0)
  const weekStart = thisWeekStart + weekOffset * 7
  const weekDays = Array.from({ length: 7 }, (_, i) => weekStart + i)
  const [mobileDay, setMobileDay] = useState(0)

  // Month view state
  const [todayY, todayM] = isoForDayNumber(today).split("-").map(Number)
  const [monthOffset, setMonthOffset] = useState(0)
  const monthIndex = todayY * 12 + (todayM - 1) + monthOffset
  const year = Math.floor(monthIndex / 12)
  const month0 = monthIndex % 12
  const firstDN = dayNumberForIso(`${year}-${String(month0 + 1).padStart(2, "0")}-01`)
  const gridStart = firstDN - weekdayIndexForDayNumber(firstDN)
  const monthCells = Array.from({ length: 42 }, (_, i) => gridStart + i)

  // A stable axis (week view) that fits every rule (min 06:00–22:00).
  const starts = schedule.map((r) => toMinutes(r.start))
  const ends = schedule.map((r) => toMinutes(r.end))
  const axisStart = Math.max(0, Math.min(6 * 60, ...starts))
  const axisEnd = Math.min(24 * 60, Math.max(22 * 60, ...ends))
  const axisSpan = axisEnd - axisStart

  const weekLabel = formatStudioDayMonthYear(
    new Date(`${isoForDayNumber(weekStart)}T12:00:00Z`).getTime(),
    ADMIN_LOCALE,
  )
  const periodLabel =
    view === "week"
      ? weekOffset === 0
        ? "This week"
        : `Week of ${weekLabel}`
      : formatStudioMonthYear(dayNumberToMs(firstDN), ADMIN_LOCALE)

  const atStart = view === "week" ? weekOffset === 0 : monthOffset === 0
  const goPrev = () =>
    view === "week"
      ? setWeekOffset((o) => Math.max(0, o - 1))
      : setMonthOffset((o) => Math.max(0, o - 1))
  const goNext = () =>
    view === "week"
      ? setWeekOffset((o) => o + 1)
      : setMonthOffset((o) => o + 1)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={atStart}
            onClick={goPrev}
            aria-label="Previous"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-28 text-center font-functional text-sm text-foreground">
            {periodLabel}
          </span>
          <Button variant="ghost" size="sm" onClick={goNext} aria-label="Next">
            <ChevronRight className="size-4" />
          </Button>
        </div>
        {/* Week / Month toggle */}
        <div className="flex items-center gap-0.5 rounded-sm border border-border p-0.5">
          {(["week", "month"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-[3px] px-2.5 py-1 font-functional text-xs capitalize transition-colors ${
                view === v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {LEGEND.map((k) => (
          <span
            key={k}
            className="flex items-center gap-1.5 font-functional text-[10px] uppercase tracking-widest-lux text-muted-foreground"
          >
            <span
              style={k === "no_work" ? STRIPES : {}}
              className={`inline-block size-3 rounded-[2px] ${blockClass(k)}`}
            />
            {SCHEDULE_KIND_LABEL[k]}
          </span>
        ))}
      </div>

      {view === "week" ? (
        <>
          <div className="hidden grid-cols-7 gap-2 md:grid">
            {weekDays.map((d) => (
              <DayColumn
                key={d}
                dayNumber={d}
                rules={rulesForDay(d)}
                isToday={d === today}
                axisStart={axisStart}
                axisSpan={axisSpan}
                onPick={onPickDay}
                onEdit={onEditRule}
              />
            ))}
          </div>
          <div className="space-y-2 md:hidden">
            <div className="flex gap-1 overflow-x-auto pb-1">
              {weekDays.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setMobileDay(i)}
                  className={`shrink-0 rounded-sm px-2.5 py-1.5 font-functional text-xs transition-colors ${
                    mobileDay === i
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted-foreground"
                  }`}
                >
                  {WEEKDAYS[weekdayIndexForDayNumber(d)].label.slice(0, 3)}{" "}
                  {Number(isoForDayNumber(d).slice(8, 10))}
                </button>
              ))}
            </div>
            <DayColumn
              dayNumber={weekDays[mobileDay]}
              rules={rulesForDay(weekDays[mobileDay])}
              isToday={weekDays[mobileDay] === today}
              axisStart={axisStart}
              axisSpan={axisSpan}
              onPick={onPickDay}
              onEdit={onEditRule}
            />
          </div>
        </>
      ) : (
        <div>
          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d) => (
              <span
                key={d.key}
                className="text-center font-functional text-[10px] uppercase tracking-widest-lux text-muted-foreground"
              >
                {d.label.slice(0, 3)}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthCells.map((d) => (
              <MonthCell
                key={d}
                dayNumber={d}
                rules={rulesForDay(d)}
                inMonth={Number(isoForDayNumber(d).slice(5, 7)) === month0 + 1}
                isToday={d === today}
                onPick={onPickDay}
                onEdit={onEditRule}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
