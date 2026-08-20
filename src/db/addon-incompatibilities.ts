import type { Db } from "./client"

/** `addon_incompatibilities` — unordered add-on pairs that can't be combined.
    Stored once per pair; readers must treat (a,b) and (b,a) as the same. */

export type AddonPair = [string, string]

/** Every incompatible pair, globally — the admin compatibility matrix. */
export async function listAllIncompatiblePairs(db: Db): Promise<AddonPair[]> {
  const { data, error } = await db
    .from("addon_incompatibilities")
    .select("addon_id_a, addon_id_b")
  if (error) throw new Error(error.message)
  return (data ?? []).map((p) => [p.addon_id_a, p.addon_id_b])
}

/** Incompatible pairs among a set of ids — both endpoints constrained, so only
    in-set pairs return. Empty for <2 ids. Throws on a real read error: the
    booking gate must fail closed on it; a slot resync can catch + degrade. */
export async function listIncompatiblePairsAmong(
  db: Db,
  addonIds: string[],
): Promise<AddonPair[]> {
  if (addonIds.length < 2) return []
  const { data, error } = await db
    .from("addon_incompatibilities")
    .select("addon_id_a, addon_id_b")
    .in("addon_id_a", addonIds)
    .in("addon_id_b", addonIds)
  if (error) throw new Error(error.message)
  return (data ?? []).map((pair) => [pair.addon_id_a, pair.addon_id_b])
}

export async function addIncompatiblePair(
  db: Db,
  a: string,
  b: string,
): Promise<{ ok: boolean }> {
  const { error } = await db
    .from("addon_incompatibilities")
    .upsert({ addon_id_a: a, addon_id_b: b }, { onConflict: "addon_id_a,addon_id_b" })
  return { ok: !error }
}

/** Remove the pair in whichever order it was stored. */
export async function removeIncompatiblePair(
  db: Db,
  a: string,
  b: string,
): Promise<{ ok: boolean }> {
  const { error } = await db
    .from("addon_incompatibilities")
    .delete()
    .or(
      `and(addon_id_a.eq.${a},addon_id_b.eq.${b}),and(addon_id_a.eq.${b},addon_id_b.eq.${a})`,
    )
  return { ok: !error }
}
