import "server-only"

import { listActiveAddonNames } from "@/db/addons"
import type { Db } from "@/db/client"
import { listActiveServiceNames } from "@/db/services"

/** Catalog input rules shared by the service and add-on writers. */

/** kr (as typed) → integer cents. Rejects negatives / non-finite. */
export function krToCents(kr: number): number | null {
  if (!Number.isFinite(kr) || kr < 0) return null
  return Math.round(kr * 100)
}

/**
 * Is an ACTIVE row (other than excludeId) already using this name in either
 * language? Catalog names must be unique — duplicates are confusing to pick
 * from. Compared case-insensitively across both name columns in JS (the catalog
 * is small, and it sidesteps PostgREST ilike-wildcard/injection concerns).
 */
export async function nameTaken(
  db: Db,
  table: "services" | "addons",
  nameEn: string,
  nameDk: string,
  excludeId: string | null,
): Promise<boolean> {
  const rows =
    table === "services"
      ? await listActiveServiceNames(db)
      : await listActiveAddonNames(db)
  const wanted = new Set([nameEn.toLowerCase(), nameDk.toLowerCase()])
  return rows.some(
    (r) =>
      r.id !== excludeId &&
      (wanted.has((r.name_en ?? "").toLowerCase()) ||
        wanted.has((r.name_dk ?? "").toLowerCase())),
  )
}
