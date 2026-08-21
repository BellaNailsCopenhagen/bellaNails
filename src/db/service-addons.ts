import type { Db } from "./client"

/**
 * `service_addons` — the many-to-many link between a service and its add-ons.
 * Also owns the shape helper for the `service_addons(addons(...))` embed, so
 * every reader flattens it the same way.
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

export type LinkedAddonDuration = {
  id: string
  extra_duration_mins: number
  archived_at: string | null
}

/** The add-ons linked to one service, with just what slot maths needs. */
export async function listAddonsForService(
  db: Db,
  serviceId: string,
): Promise<LinkedAddonDuration[]> {
  const { data } = await db
    .from("service_addons")
    .select("addons(id, extra_duration_mins, archived_at)")
    .eq("service_id", serviceId)
  return flattenServiceAddons<LinkedAddonDuration>(
    data as unknown as { addons: LinkedAddonDuration | null }[],
    { dropArchived: true },
  )
}

export async function linkAddonToService(
  db: Db,
  serviceId: string,
  addonId: string,
): Promise<{ ok: boolean }> {
  const { error } = await db
    .from("service_addons")
    .upsert(
      { service_id: serviceId, addon_id: addonId },
      { onConflict: "service_id,addon_id" },
    )
  return { ok: !error }
}

export async function unlinkAddonFromService(
  db: Db,
  serviceId: string,
  addonId: string,
): Promise<{ ok: boolean }> {
  const { error } = await db
    .from("service_addons")
    .delete()
    .eq("service_id", serviceId)
    .eq("addon_id", addonId)
  return { ok: !error }
}
