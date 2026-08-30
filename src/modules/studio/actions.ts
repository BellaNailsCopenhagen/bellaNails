"use server"

import { revalidatePath } from "next/cache"

import {
  saveOutsideHoursConfig as saveOutsideHoursConfigRow,
  saveWeeklyHours as saveWeeklyHoursRow,
} from "@/db/studio-hours"
import {
  deleteSpecialDay as deleteSpecialDayRow,
  insertSpecialDay,
} from "@/db/studio-special-days"
import { requireOwner } from "@/modules/identity/require-owner"
import {
  getScheduleConflicts,
  getScheduleSnapshot,
  type ScheduleConflict,
} from "@/modules/studio/conflicts"
import type { Json } from "@/platform/supabase/types"
import { routes } from "@/shared/routes"
import type { TimeRange, WeeklyHours } from "@/shared/studio-hours"

export type HoursResult =
  | { ok: true; conflicts?: ScheduleConflict[] }
  | { ok: false; error: string }

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

// Valid = array of [open, close] "HH:MM" pairs with open before close.
function validRanges(ranges: unknown): ranges is TimeRange[] {
  return (
    Array.isArray(ranges) &&
    ranges.every(
      (r) =>
        Array.isArray(r) &&
        r.length === 2 &&
        typeof r[0] === "string" &&
        typeof r[1] === "string" &&
        TIME.test(r[0]) &&
        TIME.test(r[1]) &&
        r[0] < r[1],
    )
  )
}

export async function saveWeeklyHours(
  weekly: WeeklyHours,
): Promise<HoursResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  for (const [day, ranges] of Object.entries(weekly)) {
    if (!validRanges(ranges)) {
      return { ok: false, error: `Invalid hours for ${day}.` }
    }
  }

  const before = await getScheduleSnapshot(supabase)
  const saved = await saveWeeklyHoursRow(supabase, weekly as Json)
  if (!saved.ok) return { ok: false, error: "Couldn’t save hours." }

  revalidatePath(routes.admin.hours)
  const conflicts = await getScheduleConflicts(before, supabase).catch(() => [])
  return { ok: true, conflicts }
}

/** Outside-hours request config: the enable flag, the outer window, and the
    weekly no-work blocks (all on studio_hours). */
export async function saveOutsideHours(input: {
  enabled: boolean
  windowStart: string
  windowEnd: string
  noWork: WeeklyHours
}): Promise<HoursResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  if (
    !TIME.test(input.windowStart) ||
    !TIME.test(input.windowEnd) ||
    input.windowStart >= input.windowEnd
  ) {
    return { ok: false, error: "The outer window's start must be before its end." }
  }
  for (const [day, ranges] of Object.entries(input.noWork)) {
    if (!validRanges(ranges)) {
      return { ok: false, error: `Invalid no-work times for ${day}.` }
    }
  }

  const before = await getScheduleSnapshot(supabase)
  const saved = await saveOutsideHoursConfigRow(supabase, {
    no_work: input.noWork as Json,
    outside_hours_enabled: input.enabled,
    outside_window_start: input.windowStart,
    outside_window_end: input.windowEnd,
  })
  if (!saved.ok) {
    return { ok: false, error: "Couldn’t save outside-hours settings." }
  }

  revalidatePath(routes.admin.hours)
  const conflicts = await getScheduleConflicts(before, supabase).catch(() => [])
  return { ok: true, conflicts }
}

export async function addSpecialDay(input: {
  startsOn: string
  endsOn?: string | null
  closed: boolean
  hours?: TimeRange[] | null
  label?: string | null
}): Promise<HoursResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }
  if (!input.startsOn) return { ok: false, error: "Pick a date." }
  if (input.endsOn && input.endsOn < input.startsOn) {
    return { ok: false, error: "End date is before the start." }
  }
  if (!input.closed && input.hours && !validRanges(input.hours)) {
    return { ok: false, error: "Invalid special hours." }
  }

  const before = await getScheduleSnapshot(supabase)
  const saved = await insertSpecialDay(supabase, {
    starts_on: input.startsOn,
    ends_on: input.endsOn || null,
    closed: input.closed,
    hours: input.closed ? null : ((input.hours ?? null) as Json),
    label: input.label?.trim() || null,
  })
  if (!saved.ok) return { ok: false, error: "Couldn’t add the special day." }

  revalidatePath(routes.admin.hours)
  const conflicts = await getScheduleConflicts(before, supabase).catch(() => [])
  return { ok: true, conflicts }
}

export async function deleteSpecialDay(id: string): Promise<HoursResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const before = await getScheduleSnapshot(supabase)
  const removed = await deleteSpecialDayRow(supabase, id)
  if (!removed.ok) return { ok: false, error: "Couldn’t remove the special day." }

  revalidatePath(routes.admin.hours)
  // Removing a special OPEN day reverts to the (closed/shorter) weekly hours,
  // which can strand a booking made into it — same conflict check as the others.
  const conflicts = await getScheduleConflicts(before, supabase).catch(() => [])
  return { ok: true, conflicts }
}
