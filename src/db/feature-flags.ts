import type { Db } from "./client"

/** `feature_flags` — the on/off STATE of each app flag (the flags themselves are
    declared in `@/shared/feature-flags`). One row per flag that's been toggled. */

/** Every stored flag's state as a `key → enabled` map. */
export async function listEnabledFlags(
  db: Db,
): Promise<Record<string, boolean>> {
  const { data } = await db.from("feature_flags").select("key, enabled")
  const map: Record<string, boolean> = {}
  for (const row of data ?? []) map[row.key] = row.enabled
  return map
}

export async function getFeatureFlagEnabled(
  db: Db,
  key: string,
): Promise<boolean> {
  const { data } = await db
    .from("feature_flags")
    .select("enabled")
    .eq("key", key)
    .maybeSingle()
  return data?.enabled ?? false
}

export async function upsertFeatureFlag(
  db: Db,
  key: string,
  enabled: boolean,
): Promise<{ ok: boolean }> {
  const { error } = await db
    .from("feature_flags")
    .upsert(
      { key, enabled, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    )
  return { ok: !error }
}
