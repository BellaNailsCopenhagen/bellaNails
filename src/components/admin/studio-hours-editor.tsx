"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Eyebrow, BodySm } from "@/components/ui/typography"
import { useActionRunner } from "@/lib/hooks/use-action-runner"
import {
  addSpecialDay,
  deleteSpecialDay,
  saveWeeklyHours,
} from "@/lib/actions/manage-studio-hours"
import {
  WEEKDAYS,
  type StudioHours,
  type TimeRange,
  type WeekdayKey,
  type WeeklyHours,
} from "@/lib/studio-hours"

const timeInput =
  "border-b border-border bg-transparent px-1 py-1 font-functional text-sm text-foreground outline-none focus-visible:border-foreground [color-scheme:light] dark:[color-scheme:dark]"

export function StudioHoursEditor({ initial }: { initial: StudioHours }) {
  const { pending, run } = useActionRunner()

  const [weekly, setWeekly] = useState<Record<WeekdayKey, TimeRange[]>>(() => {
    const w = {} as Record<WeekdayKey, TimeRange[]>
    for (const { key } of WEEKDAYS) w[key] = initial.weekly[key] ?? []
    return w
  })

  const setRange = (
    key: WeekdayKey,
    idx: number,
    which: 0 | 1,
    value: string,
  ) =>
    setWeekly((prev) => ({
      ...prev,
      [key]: prev[key].map((r, i) =>
        i === idx ? ((which === 0 ? [value, r[1]] : [r[0], value]) as TimeRange) : r,
      ),
    }))

  const addRange = (key: WeekdayKey) =>
    setWeekly((prev) => ({ ...prev, [key]: [...prev[key], ["10:00", "18:00"]] }))

  const removeRange = (key: WeekdayKey, idx: number) =>
    setWeekly((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== idx),
    }))

  const saveWeekly = () => {
    const clean: WeeklyHours = {}
    for (const { key } of WEEKDAYS) if (weekly[key].length) clean[key] = weekly[key]
    run(async () => {
      const result = await saveWeeklyHours(clean)
      if (result.ok) toast.success("Hours saved")
      return result
    })
  }

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <Eyebrow as="h3">Weekly hours</Eyebrow>
        <BodySm className="text-xs">
          A day with no rows is closed. Add two rows for a split day (e.g. a
          lunch break).
        </BodySm>
        <ul className="space-y-3">
          {WEEKDAYS.map(({ key, label }) => (
            <li key={key} className="flex flex-wrap items-center gap-3">
              <span className="w-24 shrink-0 font-functional text-sm text-foreground">
                {label}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {weekly[key].length ? (
                  weekly[key].map((range, idx) => (
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
                    Closed
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
        <div className="flex justify-end">
          <Button size="sm" disabled={pending} onClick={saveWeekly}>
            {pending ? "Saving…" : "Save weekly hours"}
          </Button>
        </div>
      </section>

      <SpecialDays special={initial.special} pending={pending} run={run} />
    </div>
  )
}

function SpecialDays({
  special,
  pending,
  run,
}: {
  special: StudioHours["special"]
  pending: boolean
  run: ReturnType<typeof useActionRunner>["run"]
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
                onClick={() => run(() => deleteSpecialDay(s.id))}
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
