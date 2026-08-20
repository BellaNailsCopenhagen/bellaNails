import type { Json } from "@/platform/supabase/types"

import type { Db, Row } from "./client"

/** `studio_special_days` — dated overrides of the weekly pattern (holidays,
    one-off closures, altered hours). Ordered by start date everywhere. */

export type SpecialDayRow = Row<"studio_special_days">

export async function listSpecialDays(db: Db): Promise<SpecialDayRow[]> {
  const { data } = await db
    .from("studio_special_days")
    .select("*")
    .order("starts_on")
  return data ?? []
}

export type SpecialDayInsert = {
  starts_on: string
  ends_on: string | null
  closed: boolean
  hours: Json | null
  label: string | null
}

export async function insertSpecialDay(
  db: Db,
  values: SpecialDayInsert,
): Promise<{ ok: boolean }> {
  const { error } = await db.from("studio_special_days").insert(values)
  return { ok: !error }
}

export async function deleteSpecialDay(
  db: Db,
  id: string,
): Promise<{ ok: boolean }> {
  const { error } = await db.from("studio_special_days").delete().eq("id", id)
  return { ok: !error }
}
