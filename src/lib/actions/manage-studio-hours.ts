"use server"

import { revalidatePath } from "next/cache"

import { requireOwner } from "@/lib/admin/require-owner"
import type { Json } from "@/platform/supabase/types"
import type { TimeRange, WeeklyHours } from "@/lib/studio-hours"

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

  const { error } = await supabase
    .from("studio_hours")
    .update({ weekly: weekly as Json, updated_at: new Date().toISOString() })
    .eq("id", true)
  if (error) return { ok: false, error: "Couldn’t save hours." }

  revalidatePath("/admin/hours")
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

  const { error } = await supabase.from("studio_special_days").insert({
    starts_on: input.startsOn,
    ends_on: input.endsOn || null,
    closed: input.closed,
    hours: input.closed ? null : ((input.hours ?? null) as Json),
    label: input.label?.trim() || null,
  })
  if (error) return { ok: false, error: "Couldn’t add the special day." }

  revalidatePath("/admin/hours")
  return { ok: true }
}

export async function deleteSpecialDay(id: string): Promise<HoursResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const { error } = await supabase
    .from("studio_special_days")
    .delete()
    .eq("id", id)
  if (error) return { ok: false, error: "Couldn’t remove the special day." }

  revalidatePath("/admin/hours")
  return { ok: true }
}
