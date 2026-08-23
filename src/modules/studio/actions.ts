"use server"

import { revalidatePath } from "next/cache"

import { saveWeeklyHours as saveWeeklyHoursRow } from "@/db/studio-hours"
import {
  deleteSpecialDay as deleteSpecialDayRow,
  insertSpecialDay,
} from "@/db/studio-special-days"
import { requireOwner } from "@/modules/identity/require-owner"
import type { Json } from "@/platform/supabase/types"
import { routes } from "@/shared/routes"
import type { TimeRange, WeeklyHours } from "@/shared/studio-hours"

export type HoursResult = { ok: true } | { ok: false; error: string }

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

  const saved = await saveWeeklyHoursRow(supabase, weekly as Json)
  if (!saved.ok) return { ok: false, error: "Couldn’t save hours." }

  revalidatePath(routes.admin.hours)
  return { ok: true }
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

  const saved = await insertSpecialDay(supabase, {
    starts_on: input.startsOn,
    ends_on: input.endsOn || null,
    closed: input.closed,
    hours: input.closed ? null : ((input.hours ?? null) as Json),
    label: input.label?.trim() || null,
  })
  if (!saved.ok) return { ok: false, error: "Couldn’t add the special day." }

  revalidatePath(routes.admin.hours)
  return { ok: true }
}

export async function deleteSpecialDay(id: string): Promise<HoursResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const removed = await deleteSpecialDayRow(supabase, id)
  if (!removed.ok) return { ok: false, error: "Couldn’t remove the special day." }

  revalidatePath(routes.admin.hours)
  return { ok: true }
}
