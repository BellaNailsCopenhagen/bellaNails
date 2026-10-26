"use server"

import { revalidatePath } from "next/cache"

import { upsertFeatureFlag } from "@/db/feature-flags"
import {
  deleteScheduleRule as deleteScheduleRuleRow,
  insertScheduleRules,
  updateScheduleRule,
} from "@/db/schedule-rules"
import { requireOwner } from "@/modules/identity/require-owner"
import { revalidatePublicShell } from "@/modules/revalidate"
import {
  getScheduleConflicts,
  getScheduleSnapshot,
  type ScheduleConflict,
} from "@/modules/studio/conflicts"
import { SCHEDULE_KINDS, type ScheduleKind } from "@/shared/schedule"
import { dayNumberForIso, isoForDayNumber } from "@/shared/studio-hours"
import { isFeatureFlagKey } from "@/shared/feature-flags"
import { routes } from "@/shared/routes"

// A dated span can't exceed this many days — guards against a runaway From/To.
const MAX_SPAN_DAYS = 366

export type HoursResult =
  { ok: true; conflicts?: ScheduleConflict[] } | { ok: false; error: string }

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

export type ScheduleRuleInput = {
  id?: string
  kind: ScheduleKind
  weekday: number | null // 0=Mon..6=Sun (recurring)
  onDate: string | null // YYYY-MM-DD (one-time; the range start when onDateEnd is set)
  /** Inclusive end date — a one-off span, stored as one single-date rule per day
      (add-mode only). */
  onDateEnd?: string | null
  start: string // "HH:MM"
  end: string
  label?: string | null
}

// Returns an error message, or null when valid. Exactly one recurrence, a valid
// weekday/date, and a start before the end.
function validateRule(input: ScheduleRuleInput): string | null {
  if (!SCHEDULE_KINDS.includes(input.kind)) {
    return "Pick a type."
  }
  const hasWeekday = input.weekday !== null && input.weekday !== undefined
  const hasDate = !!input.onDate
  if (hasWeekday === hasDate) {
    return "Pick either a weekday or a single date."
  }
  if (
    hasWeekday &&
    !(
      Number.isInteger(input.weekday) &&
      input.weekday! >= 0 &&
      input.weekday! <= 6
    )
  ) {
    return "Invalid weekday."
  }
  if (hasDate && !DATE.test(input.onDate!)) {
    return "Invalid date."
  }
  if (input.onDateEnd) {
    if (!DATE.test(input.onDateEnd)) {
      return "Invalid end date."
    }
    if (!input.onDate || input.onDateEnd < input.onDate) {
      return "The end date is before the start."
    }
    if (
      dayNumberForIso(input.onDateEnd) - dayNumberForIso(input.onDate) >=
      MAX_SPAN_DAYS
    ) {
      return "That date range is too long — pick a shorter span."
    }
  }
  if (
    !TIME.test(input.start) ||
    !TIME.test(input.end) ||
    input.start >= input.end
  ) {
    return "Start must be before end."
  }

  return null
}

/** Add or edit one schedule rule (standard / outside / no-work). A dated span
    (`onDateEnd` set, add-mode) inserts one single-date rule per day. Owner-gated;
    runs the non-blocking conflict check after saving. */
export async function saveScheduleRule(
  input: ScheduleRuleInput,
): Promise<HoursResult> {
  const supabase = await requireOwner()
  if (!supabase) {
    return { ok: false, error: "unauthorized" }
  }

  const error = validateRule(input)
  if (error) {
    return { ok: false, error }
  }

  const base = {
    kind: input.kind,
    weekday: input.onDate ? null : input.weekday,
    start_time: input.start,
    end_time: input.end,
    label: input.label?.trim() || null,
  }

  const before = await getScheduleSnapshot(supabase)

  let saved: { ok: boolean }
  if (input.id) {
    saved = await updateScheduleRule(supabase, input.id, {
      ...base,
      on_date: input.onDate ?? null,
    })
  } else if (input.onDate && input.onDateEnd) {
    // A dated span → one single-date row per day, inserted in ONE atomic write
    // (no partial-then-duplicate-on-retry).
    const first = dayNumberForIso(input.onDate)
    const last = dayNumberForIso(input.onDateEnd)
    const rows = Array.from({ length: last - first + 1 }, (_, i) => ({
      ...base,
      on_date: isoForDayNumber(first + i),
    }))
    saved = await insertScheduleRules(supabase, rows)
  } else {
    saved = await insertScheduleRules(supabase, [
      { ...base, on_date: input.onDate ?? null },
    ])
  }
  if (!saved.ok) {
    return { ok: false, error: "Couldn’t save the rule." }
  }

  revalidatePath(routes.admin.hours)
  // The footer states these hours on every page, and /hours is a page of its
  // own — all prerendered, so the whole shell has to be told.
  revalidatePublicShell()
  const conflicts = await getScheduleConflicts(before, supabase).catch(() => [])

  return { ok: true, conflicts }
}

/** Remove one schedule rule — can strand a booking, so runs the conflict check. */
export async function deleteScheduleRule(id: string): Promise<HoursResult> {
  const supabase = await requireOwner()
  if (!supabase) {
    return { ok: false, error: "unauthorized" }
  }

  const before = await getScheduleSnapshot(supabase)
  const removed = await deleteScheduleRuleRow(supabase, id)
  if (!removed.ok) {
    return { ok: false, error: "Couldn’t remove the rule." }
  }

  revalidatePath(routes.admin.hours)
  // The footer states these hours on every page, and /hours is a page of its
  // own — all prerendered, so the whole shell has to be told.
  revalidatePublicShell()
  const conflicts = await getScheduleConflicts(before, supabase).catch(() => [])

  return { ok: true, conflicts }
}

/** Toggle an app feature flag (App settings → Features). Owner-gated. */
export async function setFeatureFlag(
  key: string,
  enabled: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await requireOwner()
  if (!supabase) {
    return { ok: false, error: "unauthorized" }
  }

  // TypeScript erases the union, so this is the only thing standing between a
  // hand-made call and a `feature_flags` row nothing will ever read.
  if (!isFeatureFlagKey(key)) {
    return { ok: false, error: "Unknown setting." }
  }

  const saved = await upsertFeatureFlag(supabase, key, enabled)
  if (!saved.ok) {
    return { ok: false, error: "Couldn’t update the setting." }
  }

  revalidatePath(routes.admin.settings)

  return { ok: true }
}
