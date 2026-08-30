import type { Db } from "@/db/client"
import {
  getFeatureFlagEnabled,
  listEnabledFlags,
} from "@/db/feature-flags"
import { listScheduleRules, type ScheduleRuleRow } from "@/db/schedule-rules"
import { createSupabaseServerClient } from "@/platform/supabase/server"
import {
  FEATURE_FLAG_DEFS,
  type FeatureFlag,
  type FeatureFlagKey,
} from "@/shared/feature-flags"
import type { Schedule, ScheduleKind, ScheduleRule } from "@/shared/schedule"

function toRule(row: ScheduleRuleRow): ScheduleRule {
  return {
    id: row.id,
    kind: row.kind as ScheduleKind,
    weekday: row.weekday,
    onDate: row.on_date,
    start: row.start_time,
    end: row.end_time,
    label: row.label,
  }
}

/** The full studio schedule (every rule). Public-read; degrades to [] if the
    table isn't applied yet, so a missing migration never crashes the booking flow. */
export async function getSchedule(
  db: Db = createSupabaseServerClient(),
): Promise<Schedule> {
  const rows = await listScheduleRules(db).catch((error) => {
    // Degrade to no schedule (→ "no times"), but log it — a missing migration
    // shouldn't fail silently.
    console.error(
      "[schedule] read failed",
      error instanceof Error ? error.message : error,
    )
    return []
  })
  return rows.map(toRule)
}

/** The declared flags (from code) merged with their stored on/off state, for the
    admin App-settings area. Always returns every flag — a missing table/row just
    means "off" — so the settings list never depends on a DB seed. */
export async function getFeatureFlags(
  db: Db = createSupabaseServerClient(),
): Promise<FeatureFlag[]> {
  const enabled = await listEnabledFlags(db).catch(
    (): Record<string, boolean> => ({}),
  )
  return FEATURE_FLAG_DEFS.map((def) => ({
    ...def,
    enabled: enabled[def.key] ?? false,
  }))
}

/** Whether a feature flag is on. Degrades to false (missing table/row) so a
    feature is simply off rather than crashing. */
export async function isFeatureEnabled(
  key: FeatureFlagKey,
  db: Db = createSupabaseServerClient(),
): Promise<boolean> {
  return getFeatureFlagEnabled(db, key).catch(() => false)
}
