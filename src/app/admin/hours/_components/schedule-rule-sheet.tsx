"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { BodySm } from "@/components/ui/typography"
import type { ScheduleRuleInput } from "@/modules/studio"
import {
  SCHEDULE_KINDS,
  SCHEDULE_KIND_LABEL,
  type ScheduleKind,
  type ScheduleRule,
} from "@/shared/schedule"
import {
  dayNumberForIso,
  isoForDayNumber,
  toClock,
  toMinutes,
  weekdayIndexForDayNumber,
  WEEKDAYS,
} from "@/shared/studio-hours"
import { formatStudioDayMonthYear, studioDayNumber } from "@/shared/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"

/** What the stepper was opened for — add a rule on a clicked day, or edit one. */
export type SheetState =
  /** `startAt` is where in the day the artist tapped, when she tapped the grid
      rather than the date — the axis is readable now, so a tap means a time. */
  | { mode: "add"; dayNumber: number; startAt?: string }
  | { mode: "edit"; rule: ScheduleRule }

type Repeat = "weekly" | "date" | "range"

// Studio-local today (not UTC) — matches the day-numbers the calendar uses.
const todayIso = () => isoForDayNumber(studioDayNumber(Date.now()))
const dateLabel = (iso: string) =>
  formatStudioDayMonthYear(new Date(`${iso}T12:00:00Z`).getTime(), ADMIN_LOCALE)

const fieldLabel =
  "block font-functional text-[10px] uppercase tracking-widest-lux text-muted-foreground"
const control =
  "w-full rounded-sm border border-border bg-background p-2 font-functional text-sm text-foreground [color-scheme:light] dark:[color-scheme:dark]"
const segBtn = (active: boolean) =>
  `flex-1 rounded-[3px] px-2 py-1.5 font-functional text-sm transition-colors ${
    active
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:text-foreground"
  }`

function seed(state: SheetState) {
  if (state.mode === "edit") {
    const r = state.rule

    return {
      kind: r.kind,
      allDay: r.start === "00:00" && r.end === "23:59",
      start: r.start,
      end: r.end,
      repeat: (r.onDate ? "date" : "weekly") as Repeat,
      // A dated rule derives its weekday from its date; a weekly rule has no date,
      // so a "switch to a single date" defaults to today (not the 1970 epoch).
      weekday: r.onDate
        ? weekdayIndexForDayNumber(dayNumberForIso(r.onDate))
        : (r.weekday ?? 0),
      onDate: r.onDate ?? todayIso(),
      onDateEnd: "",
      label: r.label ?? "",
    }
  }
  // A tapped position seeds the start and keeps the default length; tapping the
  // date (no position) keeps the old 10:00–18:00.
  const start = state.startAt ?? "10:00"
  const end = toClock(Math.min(toMinutes(start) + 8 * 60, 23 * 60 + 59))

  return {
    kind: "standard" as ScheduleKind,
    allDay: false,
    start,
    end,
    repeat: "weekly" as Repeat,
    weekday: weekdayIndexForDayNumber(state.dayNumber),
    onDate: isoForDayNumber(state.dayNumber),
    onDateEnd: "",
    label: "",
  }
}

function RuleStepper({
  state,
  pending,
  onSave,
  onDelete,
}: {
  state: SheetState
  pending: boolean
  onSave: (input: ScheduleRuleInput) => void
  onDelete: (id: string) => void
}) {
  const [init] = useState(() => seed(state))
  const [step, setStep] = useState(1)
  const [kind, setKind] = useState<ScheduleKind>(init.kind)
  const [allDay, setAllDay] = useState(init.allDay)
  const [start, setStart] = useState(init.start)
  const [end, setEnd] = useState(init.end)
  const [repeat, setRepeat] = useState<Repeat>(init.repeat)
  const [weekday, setWeekday] = useState(init.weekday)
  const [onDate, setOnDate] = useState(init.onDate)
  const [onDateEnd, setOnDateEnd] = useState(init.onDateEnd)
  const [label, setLabel] = useState(init.label)

  const isEdit = state.mode === "edit"
  const timeInvalid = !allDay && start >= end
  const rangeInvalid = repeat === "range" && (!onDateEnd || onDateEnd < onDate)

  // Keep the weekly weekday in step with whatever date the artist picks, so
  // switching to "weekly" after changing the date uses the shown weekday.
  const changeDate = (value: string) => {
    setOnDate(value)
    if (value) {
      setWeekday(weekdayIndexForDayNumber(dayNumberForIso(value)))
    }
  }

  const submit = () => {
    if (timeInvalid || rangeInvalid) {
      return
    }
    onSave({
      id: isEdit ? state.rule.id : undefined,
      kind,
      weekday: repeat === "weekly" ? weekday : null,
      onDate: repeat === "weekly" ? null : onDate,
      onDateEnd: repeat === "range" ? onDateEnd : null,
      start: allDay ? "00:00" : start,
      end: allDay ? "23:59" : end,
      label: label.trim() || null,
    })
  }

  return (
    <>
      <SheetTitle>{isEdit ? "Edit rule" : "Add to the schedule"}</SheetTitle>
      <p className="font-functional text-xs text-muted-foreground">
        Step {step} of 3 ·{" "}
        {step === 1 ? "Type" : step === 2 ? "Time" : "Repeat"}
      </p>

      {step === 1 ? (
        <div className="space-y-2">
          {SCHEDULE_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k)
                setStep(2)
              }}
              className={`flex w-full flex-col items-start gap-0.5 rounded-md border p-3 text-left transition-colors ${
                kind === k
                  ? "border-foreground"
                  : "border-border hover:border-foreground/40"
              }`}
            >
              <span className="font-functional text-sm text-foreground">
                {SCHEDULE_KIND_LABEL[k]}
              </span>
              <span className="font-functional text-xs text-muted-foreground">
                {k === "standard"
                  ? "Bookable directly by clients."
                  : k === "outside"
                    ? "Clients can only request these — you approve."
                    : "Never bookable — overrides working & outside hours."}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          {kind === "no_work" ? (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="size-4"
              />
              <span className="font-functional text-sm text-foreground">
                All day
              </span>
            </label>
          ) : null}
          {allDay ? null : (
            <div className="flex gap-3">
              <label className="flex-1 space-y-1.5">
                <span className={fieldLabel}>Start</span>
                <input
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className={control}
                />
              </label>
              <label className="flex-1 space-y-1.5">
                <span className={fieldLabel}>End</span>
                <input
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className={control}
                />
              </label>
            </div>
          )}
          {timeInvalid ? (
            <BodySm className="text-xs text-destructive">
              The start must be before the end.
            </BodySm>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button size="sm" disabled={timeInvalid} onClick={() => setStep(3)}>
              Next
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <span className={fieldLabel}>Repeat</span>
            <div className="flex flex-col gap-1 rounded-sm border border-border p-0.5">
              <button
                type="button"
                onClick={() => setRepeat("weekly")}
                className={segBtn(repeat === "weekly")}
              >
                Every {WEEKDAYS[weekday].label}
              </button>
              <button
                type="button"
                onClick={() => setRepeat("date")}
                className={segBtn(repeat === "date")}
              >
                Only {dateLabel(onDate)}
              </button>
              {/* A dated span is a one-off; ranges are only offered when adding. */}
              {kind === "no_work" && !isEdit ? (
                <button
                  type="button"
                  onClick={() => setRepeat("range")}
                  className={segBtn(repeat === "range")}
                >
                  A range of dates
                </button>
              ) : null}
            </div>
          </div>

          {repeat === "date" ? (
            <label className="block space-y-1.5">
              <span className={fieldLabel}>Date</span>
              <input
                type="date"
                value={onDate}
                onChange={(e) => changeDate(e.target.value)}
                className={control}
              />
            </label>
          ) : null}
          {repeat === "range" ? (
            <div className="flex gap-3">
              <label className="flex-1 space-y-1.5">
                <span className={fieldLabel}>From</span>
                <input
                  type="date"
                  value={onDate}
                  onChange={(e) => changeDate(e.target.value)}
                  className={control}
                />
              </label>
              <label className="flex-1 space-y-1.5">
                <span className={fieldLabel}>To</span>
                <input
                  type="date"
                  value={onDateEnd}
                  onChange={(e) => setOnDateEnd(e.target.value)}
                  className={control}
                />
              </label>
            </div>
          ) : null}
          {rangeInvalid ? (
            <BodySm className="text-xs text-destructive">
              Pick an end date on or after the start.
            </BodySm>
          ) : null}

          <label className="block space-y-1.5">
            <span className={fieldLabel}>Label (optional)</span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Lunch, Easter"
              className={control}
            />
          </label>

          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              size="sm"
              disabled={pending || rangeInvalid}
              onClick={submit}
            >
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      ) : null}

      {isEdit ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => onDelete(state.rule.id!)}
          className="text-destructive hover:text-destructive"
        >
          Delete rule
        </Button>
      ) : null}
    </>
  )
}

export function ScheduleRuleSheet({
  state,
  formKey,
  pending,
  onSave,
  onDelete,
  onClose,
}: {
  state: SheetState | null
  formKey: number
  pending: boolean
  onSave: (input: ScheduleRuleInput) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  return (
    <Sheet open={state !== null} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="space-y-4">
        {state ? (
          <RuleStepper
            key={formKey}
            state={state}
            pending={pending}
            onSave={onSave}
            onDelete={onDelete}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
