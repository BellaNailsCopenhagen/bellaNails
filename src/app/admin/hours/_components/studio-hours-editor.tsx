"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Eyebrow, BodySm } from "@/components/ui/typography"
import { useActionRunner } from "@/hooks/use-action-runner"
import {
  addSpecialDay,
  deleteSpecialDay,
  saveOutsideHours,
  saveWeeklyHours,
} from "@/modules/studio/actions"
import type { OutsideHoursConfig } from "@/db/studio-hours"
import type { ScheduleConflict } from "@/modules/studio/conflicts"
import {
  WEEKDAYS,
  type StudioHours,
  type TimeRange,
  type WeekdayKey,
  type WeeklyHours,
} from "@/shared/studio-hours"
import { formatStudioDayMonthYear, formatStudioTime } from "@/shared/studio-time"
import { ADMIN_LOCALE } from "@/config/admin"

const CONFLICT_REASON: Record<ScheduleConflict["reason"], string> = {
  no_work: "now in a no-work block",
  outside_hours: "now outside working hours",
  closed: "on a now-closed day",
}

/** Non-blocking heads-up: existing bookings a schedule change would strand. */
function ConflictsWarning({ conflicts }: { conflicts: ScheduleConflict[] }) {
  if (!conflicts.length) return null
  return (
    <div className="space-y-2 rounded-md border border-warning/50 bg-warning/10 p-4">
      <p className="font-functional text-sm font-medium text-foreground">
        Heads up — {conflicts.length} existing booking
        {conflicts.length === 1 ? "" : "s"} no longer fit your hours
      </p>
      <ul className="space-y-1">
        {conflicts.map((c) => (
          <li key={c.bookingId} className="font-functional text-xs text-muted-foreground">
            {c.clientName} ·{" "}
            {formatStudioDayMonthYear(new Date(c.start).getTime(), ADMIN_LOCALE)} ·{" "}
            {formatStudioTime(c.start, ADMIN_LOCALE)}–{formatStudioTime(c.end, ADMIN_LOCALE)}{" "}
            · {CONFLICT_REASON[c.reason]}
          </li>
        ))}
      </ul>
      <p className="font-functional text-xs text-muted-foreground">
        Nothing was cancelled — reschedule or contact them from the queue if needed.
      </p>
    </div>
  )
}

const timeInput =
  "border-b border-border bg-transparent px-1 py-1 font-functional text-sm text-foreground outline-none focus-visible:border-foreground [color-scheme:light] dark:[color-scheme:dark]"

type WeekMap = Record<WeekdayKey, TimeRange[]>

const emptyWeek = (source: WeeklyHours): WeekMap => {
  const week = {} as WeekMap
  for (const { key } of WEEKDAYS) week[key] = source[key] ?? []
  return week
}

const cleanWeek = (week: WeekMap): WeeklyHours => {
  const clean: WeeklyHours = {}
  for (const { key } of WEEKDAYS) if (week[key].length) clean[key] = week[key]
  return clean
}

/** The per-weekday interval grid — shared by weekly hours and no-work blocks. */
function WeeklyRangeGrid({
  value,
  onChange,
  emptyLabel,
  defaultRange,
}: {
  value: WeekMap
  onChange: (next: WeekMap) => void
  emptyLabel: string
  defaultRange: TimeRange
}) {
  const setRange = (key: WeekdayKey, idx: number, which: 0 | 1, v: string) =>
    onChange({
      ...value,
      [key]: value[key].map((r, i) =>
        i === idx ? ((which === 0 ? [v, r[1]] : [r[0], v]) as TimeRange) : r,
      ),
    })
  const addRange = (key: WeekdayKey) =>
    onChange({ ...value, [key]: [...value[key], defaultRange] })
  const removeRange = (key: WeekdayKey, idx: number) =>
    onChange({ ...value, [key]: value[key].filter((_, i) => i !== idx) })

  return (
    <ul className="space-y-3">
      {WEEKDAYS.map(({ key, label }) => (
        <li key={key} className="flex flex-wrap items-center gap-3">
          <span className="w-24 shrink-0 font-functional text-sm text-foreground">
            {label}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {value[key].length ? (
              value[key].map((range, idx) => (
                <span key={idx} className="flex items-center gap-1">
                  <input
                    type="time"
                    value={range[0]}
                    onChange={(e) => setRange(key, idx, 0, e.target.value)}
                    className={timeInput}
                  />
                  <span className="text-muted-foreground">–</span>
                  <input
                    type="time"
                    value={range[1]}
                    onChange={(e) => setRange(key, idx, 1, e.target.value)}
                    className={timeInput}
                  />
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => removeRange(key, idx)}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ))
            ) : (
              <span className="font-functional text-xs text-muted-foreground">
                {emptyLabel}
              </span>
            )}
            <button
              type="button"
              onClick={() => addRange(key)}
              className="font-functional text-[0.625rem] uppercase tracking-widest-lux text-muted-foreground transition-colors hover:text-foreground"
            >
              + Add
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function StudioHoursEditor({
  initial,
  outside,
}: {
  initial: StudioHours
  outside: OutsideHoursConfig | null
}) {
  const { pending, run } = useActionRunner()
  const [weekly, setWeekly] = useState<WeekMap>(() => emptyWeek(initial.weekly))
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([])

  const saveWeekly = () =>
    run(async () => {
      const result = await saveWeeklyHours(cleanWeek(weekly))
      if (result.ok) {
        toast.success("Hours saved")
        setConflicts(result.conflicts ?? [])
      }
      return result
    })

  return (
    <div className="space-y-10">
      <ConflictsWarning conflicts={conflicts} />
      <section className="space-y-3">
        <Eyebrow as="h3">Weekly hours</Eyebrow>
        <BodySm className="text-xs">
          A day with no rows is closed. Add two rows for a split day (e.g. a
          lunch break).
        </BodySm>
        <WeeklyRangeGrid
          value={weekly}
          onChange={setWeekly}
          emptyLabel="Closed"
          defaultRange={["10:00", "18:00"]}
        />
        <div className="flex justify-end">
          <Button size="sm" disabled={pending} onClick={saveWeekly}>
            {pending ? "Saving…" : "Save weekly hours"}
          </Button>
        </div>
      </section>

      <OutsideHoursSection
        outside={outside}
        pending={pending}
        run={run}
        onConflicts={setConflicts}
      />

      <SpecialDays
        special={initial.special}
        pending={pending}
        run={run}
        onConflicts={setConflicts}
      />
    </div>
  )
}

function OutsideHoursSection({
  outside,
  pending,
  run,
  onConflicts,
}: {
  outside: OutsideHoursConfig | null
  pending: boolean
  run: ReturnType<typeof useActionRunner>["run"]
  onConflicts: (conflicts: ScheduleConflict[]) => void
}) {
  const [enabled, setEnabled] = useState(outside?.enabled ?? false)
  const [windowStart, setWindowStart] = useState(outside?.windowStart ?? "06:00")
  const [windowEnd, setWindowEnd] = useState(outside?.windowEnd ?? "20:00")
  const [noWork, setNoWork] = useState<WeekMap>(() =>
    emptyWeek((outside?.noWork as WeeklyHours | null) ?? {}),
  )

  const save = () =>
    run(async () => {
      const result = await saveOutsideHours({
        enabled,
        windowStart,
        windowEnd,
        noWork: cleanWeek(noWork),
      })
      if (result.ok) {
        toast.success("Outside-hours settings saved")
        onConflicts(result.conflicts ?? [])
      }
      return result
    })

  return (
    <section className="space-y-4">
      <Eyebrow as="h3">Outside-hours requests</Eyebrow>
      <BodySm className="text-xs">
        Let clients REQUEST a time outside your normal hours (you approve each
        one). No-work blocks are removed from both normal and outside-hours slots.
      </BodySm>

      <label className="flex items-center gap-2 font-functional text-sm text-foreground">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Allow clients to request outside-hours times
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <span className="w-24 shrink-0 font-functional text-sm text-foreground">
          Window
        </span>
        <input
          type="time"
          value={windowStart}
          onChange={(e) => setWindowStart(e.target.value)}
          className={timeInput}
        />
        <span className="text-muted-foreground">–</span>
        <input
          type="time"
          value={windowEnd}
          onChange={(e) => setWindowEnd(e.target.value)}
          className={timeInput}
        />
        <span className="font-functional text-xs text-muted-foreground">
          the earliest/latest a request may fall
        </span>
      </div>

      <div className="space-y-2">
        <BodySm className="text-xs text-muted-foreground">
          No-work blocks (never bookable) — e.g. a lunch break, or a full day off.
        </BodySm>
        <WeeklyRangeGrid
          value={noWork}
          onChange={setNoWork}
          emptyLabel="None"
          defaultRange={["12:00", "13:00"]}
        />
      </div>

      <div className="flex justify-end">
        <Button size="sm" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save outside-hours settings"}
        </Button>
      </div>
    </section>
  )
}

function SpecialDays({
  special,
  pending,
  run,
  onConflicts,
}: {
  special: StudioHours["special"]
  pending: boolean
  run: ReturnType<typeof useActionRunner>["run"]
  onConflicts: (conflicts: ScheduleConflict[]) => void
}) {
  const [startsOn, setStartsOn] = useState("")
  const [endsOn, setEndsOn] = useState("")
  const [closed, setClosed] = useState(true)
  const [open, setOpen] = useState<TimeRange>(["10:00", "16:00"])
  const [label, setLabel] = useState("")

  const add = () =>
    run(async () => {
      const result = await addSpecialDay({
        startsOn,
        endsOn: endsOn || null,
        closed,
        hours: closed ? null : [open],
        label,
      })
      if (result.ok) {
        toast.success("Special day added")
        setStartsOn("")
        setEndsOn("")
        setLabel("")
        onConflicts(result.conflicts ?? [])
      }
      return result
    })

  return (
    <section className="space-y-3">
      <Eyebrow as="h3">Special days</Eyebrow>
      <BodySm className="text-xs">
        One-off overrides — a closed day or range (Easter, holidays) or special
        opening hours.
      </BodySm>

      {special.length ? (
        <ul className="space-y-2">
          {special.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-sm border border-border p-2"
            >
              <div className="min-w-0">
                <p className="font-functional text-sm text-foreground">
                  {s.startsOn}
                  {s.endsOn ? ` → ${s.endsOn}` : ""}
                  {s.label ? ` · ${s.label}` : ""}
                </p>
                <p className="font-functional text-xs text-muted-foreground">
                  {s.closed
                    ? "Closed"
                    : (s.hours ?? [])
                        .map(([a, b]) => `${a}–${b}`)
                        .join(", ") || "Open"}
                </p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    const result = await deleteSpecialDay(s.id)
                    if (result.ok) onConflicts(result.conflicts ?? [])
                    return result
                  })
                }
                className="shrink-0 font-functional text-[0.625rem] uppercase tracking-widest-lux text-destructive/70 transition-colors hover:text-destructive"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <BodySm className="text-xs">No special days.</BodySm>
      )}

      <div className="space-y-3 rounded-sm border border-dashed border-border p-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <span className="block font-functional text-[10px] uppercase tracking-widest-lux text-muted-foreground">
              Date
            </span>
            <input
              type="date"
              value={startsOn}
              onChange={(e) => setStartsOn(e.target.value)}
              className={timeInput}
            />
          </label>
          <label className="space-y-1">
            <span className="block font-functional text-[10px] uppercase tracking-widest-lux text-muted-foreground">
              To (optional)
            </span>
            <input
              type="date"
              value={endsOn}
              onChange={(e) => setEndsOn(e.target.value)}
              className={timeInput}
            />
          </label>
          <label className="flex items-center gap-2 font-functional text-sm text-foreground">
            <input
              type="checkbox"
              checked={closed}
              onChange={(e) => setClosed(e.target.checked)}
            />
            Closed
          </label>
        </div>

        {!closed ? (
          <div className="flex items-center gap-1">
            <input
              type="time"
              value={open[0]}
              onChange={(e) => setOpen([e.target.value, open[1]])}
              className={timeInput}
            />
            <span className="text-muted-foreground">–</span>
            <input
              type="time"
              value={open[1]}
              onChange={(e) => setOpen([open[0], e.target.value])}
              className={timeInput}
            />
          </div>
        ) : null}

        <Input value={label} onValueChange={setLabel} placeholder="Label (e.g. Easter)" />

        <div className="flex justify-end">
          <Button size="sm" disabled={pending || !startsOn} onClick={add}>
            Add special day
          </Button>
        </div>
      </div>
    </section>
  )
}
