import "server-only"

import { listActiveAddonNames } from "@/db/addons"
import { listActiveCategoryNames } from "@/db/categories"
import type { Db } from "@/db/client"
import { listActiveServiceNames, type CatalogName } from "@/db/services"

/** Catalog input rules shared by the service, add-on and category writers. */

/** kr (as typed) → integer cents. Rejects negatives / non-finite. Zero passes:
    a free ADD-ON is ordinary (a bundled extra at no charge), which is why its
    duration may be zero too. See `serviceCents` for the service rule. */
export function krToCents(kr: number): number | null {
  if (!Number.isFinite(kr) || kr < 0) return null
  return Math.round(kr * 100)
}

/**
 * A SERVICE's price in cents, or null if it isn't one.
 *
 * Zero is refused, and the asymmetry with add-ons is deliberate. `Number("")`
 * is 0 and 0 was a valid price, so an empty field and a deliberate "free"
 * arrived at the action as the same value — and a blank price put a 0 kr
 * service on the public menu and into the booking flow, where a client could
 * book it.
 *
 * A genuinely free service would be a product decision (an intro offer, a
 * make-good) and it needs its own affordance rather than inheriting an empty
 * box. Until it has one, a service costs something.
 */
export function serviceCents(kr: number): number | null {
  const cents = krToCents(kr)
  return cents !== null && cents > 0 ? cents : null
}

const NAME_READERS = {
  services: listActiveServiceNames,
  addons: listActiveAddonNames,
  categories: listActiveCategoryNames,
} as const

/**
 * Is an ACTIVE row (other than excludeId) already using this name in either
 * language? Catalog names must be unique — duplicates are confusing to pick
 * from. Compared case-insensitively across both name columns in JS (the catalog
 * is small, and it sidesteps PostgREST ilike-wildcard/injection concerns).
 */
export async function nameTaken(
  db: Db,
  table: keyof typeof NAME_READERS,
  nameEn: string,
  nameDk: string,
  excludeId: string | null,
): Promise<boolean> {
  const rows: CatalogName[] = await NAME_READERS[table](db)
  const wanted = new Set([nameEn.toLowerCase(), nameDk.toLowerCase()])
  return rows.some(
    (r) =>
      r.id !== excludeId &&
      (wanted.has((r.name_en ?? "").toLowerCase()) ||
        wanted.has((r.name_dk ?? "").toLowerCase())),
  )
}
