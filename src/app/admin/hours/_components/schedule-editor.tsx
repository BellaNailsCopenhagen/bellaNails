"use client"

import { useState } from "react"
import Link from "next/link"

import { Eyebrow, BodySm } from "@/components/ui/typography"
import { useActionRunner } from "@/hooks/use-action-runner"
import {
  deleteScheduleRule,
  saveScheduleRule,
} from "@/modules/studio/actions"
import type { ScheduleConflict } from "@/modules/studio/conflicts"
import type { Schedule } from "@/shared/schedule"
import { formatStudioDayMonthYear, formatStudioTime } from "@/shared/studio-time"
import { routes } from "@/shared/routes"
import { ADMIN_LOCALE } from "@/config/admin"

import { ScheduleRuleSheet, type SheetState } from "./schedule-rule-sheet"
import { ScheduleCalendar } from "./schedule-calendar"

const CONFLICT_REASON: Record<ScheduleConflict["reason"], string> = {
  no_work: "now in a time-off block",
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
          <li
            key={c.bookingId}
            className="font-functional text-xs text-muted-foreground"
          >
            {c.clientName} ·{" "}
            {formatStudioDayMonthYear(new Date(c.start).getTime(), ADMIN_LOCALE)} ·{" "}
            {formatStudioTime(c.start, ADMIN_LOCALE)}–
            {formatStudioTime(c.end, ADMIN_LOCALE)} · {CONFLICT_REASON[c.reason]}
          </li>
        ))}
      </ul>
      <p className="font-functional text-xs text-muted-foreground">
        Nothing was cancelled — reschedule or contact them from the queue if needed.
      </p>
    </div>
  )
}

/** The unified schedule editor: a navigable week calendar of standard / outside /
    no-work blocks (recurring or dated), edited through a stepper. Every save runs
    the non-blocking conflict check. */
export function ScheduleEditor({
  schedule,
  now,
}: {
  schedule: Schedule
  now: number
}) {
  const { pending, run } = useActionRunner()
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([])
  const [sheet, setSheet] = useState<SheetState | null>(null)
  // Bumped on every open so the stepper remounts + re-seeds from the state.
  const [formKey, setFormKey] = useState(0)
  const openSheet = (next: SheetState) => {
    setFormKey((k) => k + 1)
    setSheet(next)
  }

  const saveRule = (input: Parameters<typeof saveScheduleRule>[0]) =>
    run(async () => {
      const res = await saveScheduleRule(input)
      if (res.ok) {
        setConflicts(res.conflicts ?? [])
        setSheet(null)
      }
      return res
    })

  const removeRule = (id: string) =>
    run(async () => {
      const res = await deleteScheduleRule(id)
      if (res.ok) {
        setConflicts(res.conflicts ?? [])
        setSheet(null)
      }
      return res
    })

  return (
    <div className="space-y-8">
      <ConflictsWarning conflicts={conflicts} />

      <section className="space-y-3">
        <Eyebrow as="h2">Schedule</Eyebrow>
        <BodySm className="text-xs">
          Tap a day to add hours, or a block to edit it. A rule repeats every week
          or lands on a single date — layer working, outside &amp; off freely.
        </BodySm>
        <ScheduleCalendar
          schedule={schedule}
          now={now}
          onPickDay={(dayNumber) => openSheet({ mode: "add", dayNumber })}
          onEditRule={(rule) => openSheet({ mode: "edit", rule })}
        />
      </section>

      <section className="space-y-2">
        <Eyebrow as="h2">Outside-hours requests</Eyebrow>
        <BodySm className="text-xs">
          Draw the requestable times as “Outside” blocks above, then turn the
          feature on in{" "}
          <Link
            href={routes.admin.settings}
            className="underline underline-offset-2 hover:text-foreground"
          >
            App settings → Features
          </Link>
          .
        </BodySm>
      </section>

      <ScheduleRuleSheet
        state={sheet}
        formKey={formKey}
        pending={pending}
        onSave={saveRule}
        onDelete={removeRule}
        onClose={() => setSheet(null)}
      />
    </div>
  )
}
