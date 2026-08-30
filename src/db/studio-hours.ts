import type { Json } from "@/platform/supabase/types"

import type { Db } from "./client"

/** `studio_hours` — a single-row table (`id` is the literal `true`) holding the
    weekly opening pattern as JSON. */

export async function getWeeklyHours(db: Db): Promise<Json | null> {
  const { data } = await db
    .from("studio_hours")
    .select("weekly")
    .eq("id", true)
    .maybeSingle()
  return data?.weekly ?? null
}

export async function saveWeeklyHours(
  db: Db,
  weekly: Json,
): Promise<{ ok: boolean }> {
  const { error } = await db
    .from("studio_hours")
    .update({ weekly, updated_at: new Date().toISOString() })
    .eq("id", true)
  return { ok: !error }
}

export type OutsideHoursConfig = {
  noWork: Json | null
  enabled: boolean
  windowStart: string
  windowEnd: string
}

/** The outside-hours availability config (no-work blocks + the enable flag +
    the outer window), all on studio_hours — one read for the slot engine. */
export async function getOutsideHoursConfig(
  db: Db,
): Promise<OutsideHoursConfig | null> {
  const { data } = await db
    .from("studio_hours")
    .select(
      "no_work, outside_hours_enabled, outside_window_start, outside_window_end",
    )
    .eq("id", true)
    .maybeSingle()
  if (!data) return null
  return {
    noWork: data.no_work ?? null,
    enabled: data.outside_hours_enabled,
    windowStart: data.outside_window_start,
    windowEnd: data.outside_window_end,
  }
}

/** Persist the outside-hours config (admin hours editor) — one update covering
    the no-work blocks, the enable flag, and the outer window together. */
export async function saveOutsideHoursConfig(
  db: Db,
  config: {
    no_work?: Json
    outside_hours_enabled?: boolean
    outside_window_start?: string
    outside_window_end?: string
  },
): Promise<{ ok: boolean }> {
  const { error } = await db
    .from("studio_hours")
    .update({ ...config, updated_at: new Date().toISOString() })
    .eq("id", true)
  return { ok: !error }
}
