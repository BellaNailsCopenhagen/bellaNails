import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/platform/supabase/types"

/**
 * Shared helpers for the `service_addons(addons(...))` many-to-many embed, so
 * the flatten + the incompatible-pair fetch live in one place rather than being
 * re-derived per reader (booking flow, admin catalog, slot resync). Client-safe.
 */

/** Flatten the double-embed to its add-on rows, dropping nulls (and archived
    rows when asked — the client surfaces hide archived; admin keeps them). */
export function flattenServiceAddons<T>(
  serviceAddons: { addons: T | null }[] | null | undefined,
  opts: { dropArchived?: boolean } = {},
): T[] {
  const addons = (serviceAddons ?? [])
    .map((link) => link.addons)
    .filter((addon): addon is T => Boolean(addon))
  return opts.dropArchived
    ? addons.filter(
        (addon) => !(addon as { archived_at?: string | null }).archived_at,
      )
    : addons
}

/** Incompatible add-on pairs among a set of ids — both endpoints constrained,
    so only in-set pairs return. Empty for <2 ids. Throws on a real read error:
    the booking gate must fail closed on it; a slot resync can catch + degrade. */
export async function fetchIncompatiblePairs(
  supabase: SupabaseClient<Database>,
  addonIds: string[],
): Promise<[string, string][]> {
  if (addonIds.length < 2) return []
  const { data, error } = await supabase
    .from("addon_incompatibilities")
    .select("addon_id_a, addon_id_b")
    .in("addon_id_a", addonIds)
    .in("addon_id_b", addonIds)
  if (error) throw new Error(error.message)
  return (data ?? []).map((pair) => [pair.addon_id_a, pair.addon_id_b])
}
