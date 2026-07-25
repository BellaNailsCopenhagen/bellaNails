import "server-only"

import { ACTIVE_BOOKING_STATUSES } from "@/lib/booking-status"
import {
  fetchIncompatiblePairs,
  flattenServiceAddons,
} from "@/lib/services/service-addons"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/types"

/**
 * The whole catalog for admin management — categories, services, and add-ons
 * INCLUDING archived rows (the client reads hide those). Read with the
 * service-role client: the /admin route is owner-gated by the proxy, and
 * catalog writes already run service-role, so reads live in the same lane.
 */

export type AdminAddon = Pick<
  Database["public"]["Tables"]["addons"]["Row"],
  "id" | "name_en" | "name_dk" | "extra_price_cents" | "extra_duration_mins" | "archived_at"
>

export type AdminService = Pick<
  Database["public"]["Tables"]["services"]["Row"],
  | "id"
  | "name_en"
  | "name_dk"
  | "description_en"
  | "description_dk"
  | "base_price_cents"
  | "base_duration_mins"
  | "cal_event_slug"
  | "category_id"
  | "archived_at"
> & { addons: AdminAddon[] }

export type AdminCategory = Pick<
  Database["public"]["Tables"]["categories"]["Row"],
  "id" | "name_en" | "name_dk" | "sort_order" | "archived_at"
> & { services: AdminService[] }

export type AdminCatalog = {
  categories: AdminCategory[]
  /** Services with no (or a dangling) category — still manageable. */
  uncategorized: AdminService[]
}

// Add-ons come through the service_addons join now (many-to-many).
const SERVICE_SELECT =
  "id, name_en, name_dk, description_en, description_dk, base_price_cents, base_duration_mins, cal_event_slug, category_id, archived_at, service_addons(addons(id, name_en, name_dk, extra_price_cents, extra_duration_mins, archived_at))"

type RawService = Omit<AdminService, "addons"> & {
  service_addons: { addons: AdminAddon | null }[]
}

function flattenService(raw: RawService): AdminService {
  const { service_addons, ...rest } = raw
  return { ...rest, addons: flattenServiceAddons<AdminAddon>(service_addons) }
}

export async function getAdminCatalog(): Promise<AdminCatalog> {
  const supabase = createSupabaseServiceRoleClient()

  const [categoriesRes, servicesRes] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name_en, name_dk, sort_order, archived_at")
      .order("sort_order", { ascending: true }),
    supabase
      .from("services")
      .select(SERVICE_SELECT)
      .order("name_en", { ascending: true }),
  ])

  if (categoriesRes.error) throw new Error(categoriesRes.error.message)
  if (servicesRes.error) throw new Error(servicesRes.error.message)

  const services = ((servicesRes.data ?? []) as unknown as RawService[]).map(
    flattenService,
  )
  const byCategory = new Map<string, AdminService[]>()
  const uncategorized: AdminService[] = []
  const categoryIds = new Set((categoriesRes.data ?? []).map((c) => c.id))
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

  const categories: AdminCategory[] = (categoriesRes.data ?? []).map(
    (category) => ({ ...category, services: byCategory.get(category.id) ?? [] }),
  )

  return { categories, uncategorized }
}

/** Every add-on (standalone, reusable) — for the Add-ons tab + service picker. */
export async function getAllAddons(): Promise<AdminAddon[]> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("addons")
    .select(
      "id, name_en, name_dk, extra_price_cents, extra_duration_mins, archived_at",
    )
    .order("name_en", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as AdminAddon[]
}

/** All incompatible add-on pairs (global). */
export async function getAllIncompatibilities(): Promise<[string, string][]> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("addon_incompatibilities")
    .select("addon_id_a, addon_id_b")
  if (error) throw new Error(error.message)
  return (data ?? []).map((p) => [p.addon_id_a, p.addon_id_b])
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
export async function getServiceDetail(id: string): Promise<ServiceDetail | null> {
  const supabase = createSupabaseServiceRoleClient()

  const { data: raw, error } = await supabase
    .from("services")
    .select(SERVICE_SELECT)
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!raw) return null

  const service = flattenService(raw as unknown as RawService)
  const addonIds = service.addons.map((addon) => addon.id)

  const { count } = await supabase
    .from("bookings")
    .select("cal_booking_id", { count: "exact", head: true })
    .filter("selected_addons->>serviceId", "eq", id)
    .in("status", [...ACTIVE_BOOKING_STATUSES])
    .is("no_show_at", null)

  let categoryName: string | null = null
  if (service.category_id) {
    const { data } = await supabase
      .from("categories")
      .select("name_en")
      .eq("id", service.category_id)
      .maybeSingle()
    categoryName = data?.name_en ?? null
  }

  const incompatiblePairs = await fetchIncompatiblePairs(supabase, addonIds)

  return {
    service,
    categoryName,
    incompatiblePairs,
    validBookings: count ?? 0,
  }
}
