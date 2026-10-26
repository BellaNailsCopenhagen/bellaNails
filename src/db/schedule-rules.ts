import type { Db, Row } from "./client"

/** `schedule_rules` — the unified schedule: one row per standard / outside /
    no-work block, recurring on a weekday or one-off on a date. */

export type ScheduleRuleRow = Row<"schedule_rules">

export async function listScheduleRules(db: Db): Promise<ScheduleRuleRow[]> {
  const { data } = await db.from("schedule_rules").select("*")

  return data ?? []
}

export type ScheduleRuleInsert = {
  kind: string
  weekday: number | null
  on_date: string | null
  start_time: string
  end_time: string
  label: string | null
}

/** Insert one or many rules in a single statement — a dated span becomes one
    atomic write (no partial-write-then-duplicate-on-retry). */
export async function insertScheduleRules(
  db: Db,
  rows: ScheduleRuleInsert[],
): Promise<{ ok: boolean }> {
  const { error } = await db.from("schedule_rules").insert(rows)

  return { ok: !error }
}

export async function updateScheduleRule(
  db: Db,
  id: string,
  values: Partial<ScheduleRuleInsert>,
): Promise<{ ok: boolean }> {
  const { error } = await db.from("schedule_rules").update(values).eq("id", id)

  return { ok: !error }
}

export async function deleteScheduleRule(
  db: Db,
  id: string,
): Promise<{ ok: boolean }> {
  const { error } = await db.from("schedule_rules").delete().eq("id", id)

  return { ok: !error }
}
