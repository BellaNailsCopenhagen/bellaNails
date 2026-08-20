import type { AddonRow, CatalogName } from "./services"
import type { Db, Row } from "./client"

/** `addons` table access. Add-ons are standalone and reusable — a service
    links them via `service_addons`, it does not own them. */

const ADDON_COLUMNS =
  "id, name_en, name_dk, extra_price_cents, extra_duration_mins, archived_at"

export type { AddonRow }

/** Every add-on including archived — the Add-ons tab and service picker. */
export async function listAllAddons(db: Db): Promise<AddonRow[]> {
  const { data, error } = await db
    .from("addons")
    .select(ADDON_COLUMNS)
    .order("name_en", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as AddonRow[]
}

/** Names for the as-booked snapshot, in the order the client picked them. */
export async function listAddonNames(
  db: Db,
  ids: string[],
): Promise<Pick<Row<"addons">, "id" | "name_en" | "name_dk">[]> {
  if (ids.length === 0) return []
  const { data } = await db
    .from("addons")
    .select("id, name_en, name_dk")
    .in("id", ids)
  return data ?? []
}

/** Active names in both languages — the uniqueness check compares in JS. */
export async function listActiveAddonNames(db: Db): Promise<CatalogName[]> {
  const { data } = await db
    .from("addons")
    .select("id, name_en, name_dk")
    .is("archived_at", null)
  return data ?? []
}

/** Current price, read before an update so the caller knows if it changed. */
export async function getAddonPrice(
  db: Db,
  id: string,
): Promise<number | null> {
  const { data } = await db
    .from("addons")
    .select("extra_price_cents")
    .eq("id", id)
    .maybeSingle()
  return data?.extra_price_cents ?? null
}

export type AddonFields = {
  name_en: string
  name_dk: string
  extra_price_cents: number
  extra_duration_mins: number
}

export async function insertAddon(
  db: Db,
  values: AddonFields,
): Promise<{ ok: true; id: string } | { ok: false }> {
  const { data, error } = await db
    .from("addons")
    .insert(values)
    .select("id")
    .single()
  if (error || !data) return { ok: false }
  return { ok: true, id: data.id }
}

export async function updateAddon(
  db: Db,
  id: string,
  values: Partial<AddonFields>,
): Promise<{ ok: boolean }> {
  const { error } = await db.from("addons").update(values).eq("id", id)
  return { ok: !error }
}

/** Soft delete / restore. `at` is null to un-archive. */
export async function setAddonArchived(
  db: Db,
  id: string,
  at: string | null,
): Promise<{ ok: boolean }> {
  const { error } = await db
    .from("addons")
    .update({ archived_at: at })
    .eq("id", id)
  return { ok: !error }
}
