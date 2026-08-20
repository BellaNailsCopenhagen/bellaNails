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
