import "server-only"

import { listAllAddons, type AddonRow } from "@/db/addons"
import { listAllIncompatiblePairs, listIncompatiblePairsAmong } from "@/db/addon-incompatibilities"
import { countActiveBookingsForService } from "@/db/bookings"
import {
  getCategoryName,
  listAdminCategories,
  type AdminCategoryRow,
} from "@/db/categories"
import {
  getAdminService,
  listAdminServices,
  type AdminServiceRow,
} from "@/db/services"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"

/**
 * The whole catalog for admin management — categories, services, and add-ons
 * INCLUDING archived rows (the client reads hide those). Read with the
 * service-role client: the /admin route is owner-gated by the proxy, and
 * catalog writes already run service-role, so reads live in the same lane.
 */

export type AdminAddon = AddonRow
export type AdminService = AdminServiceRow

export type AdminCategory = AdminCategoryRow & { services: AdminService[] }

export type AdminCatalog = {
  categories: AdminCategory[]
  /** Services with no (or a dangling) category — still manageable. */
  uncategorized: AdminService[]
}

export async function getAdminCatalog(): Promise<AdminCatalog> {
  const db = createSupabaseServiceRoleClient()
  const [categoryRows, services] = await Promise.all([
    listAdminCategories(db),
    listAdminServices(db),
  ])

  const byCategory = new Map<string, AdminService[]>()
  const uncategorized: AdminService[] = []
  const categoryIds = new Set(categoryRows.map((c) => c.id))
  for (const service of services) {
    const cat = service.category_id
    if (cat && categoryIds.has(cat)) {
      const list = byCategory.get(cat) ?? []
      list.push(service)
      byCategory.set(cat, list)
    } else {
      uncategorized.push(service)
    }
  }

  const categories = categoryRows.map((category) => ({
    ...category,
    services: byCategory.get(category.id) ?? [],
  }))
  return { categories, uncategorized }
}

/** Every add-on (standalone, reusable) — for the Add-ons tab + service picker. */
export async function getAllAddons(): Promise<AdminAddon[]> {
  return listAllAddons(createSupabaseServiceRoleClient())
}

/** All incompatible add-on pairs (global). */
export async function getAllIncompatibilities(): Promise<[string, string][]> {
  return listAllIncompatiblePairs(createSupabaseServiceRoleClient())
}

export type ServiceDetail = {
  service: AdminService
  categoryName: string | null
  /** Add-on id pairs that can't be combined, within this service. */
  incompatiblePairs: [string, string][]
  /** Honoured bookings (active status, not a no-show) — the "valid" count. */
  validBookings: number
}

/** One service with everything the detail page needs. Null if the id is
    unknown. Service-role, owner-gated route (same lane as the list). */
export async function getServiceDetail(
  id: string,
): Promise<ServiceDetail | null> {
  const db = createSupabaseServiceRoleClient()

  const service = await getAdminService(db, id)
  if (!service) return null

  const [validBookings, categoryName, incompatiblePairs] = await Promise.all([
    countActiveBookingsForService(db, id),
    service.category_id ? getCategoryName(db, service.category_id) : null,
    listIncompatiblePairsAmong(
      db,
      service.addons.map((addon) => addon.id),
    ),
  ])

  return { service, categoryName, incompatiblePairs, validBookings }
}
