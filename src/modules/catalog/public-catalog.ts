import {
  getBookableService,
  getPublicServiceRow,
  listFeaturedServiceRows,
  type PublicServiceRow,
} from "@/db/services"
import { listIncompatiblePairsAmong } from "@/db/addon-incompatibilities"
import { listMenuCategories, type MenuCategoryRow } from "@/db/categories"
import type { Db } from "@/db/client"
import { flattenServiceAddons } from "@/db/service-addons"
import { createSupabaseServerClient } from "@/platform/supabase/server"

/**
 * The public, anon-readable catalog: the menu, the featured strip, one
 * service's detail, and the bookable shape the /book customiser needs.
 *
 * Each read defaults to a fresh anon client — the standard RSC pattern — but
 * accepts one so a single request can share an instance across reads.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const FEATURED_LIMIT = 3

export type FeaturedService = PublicServiceRow

/** Public featured services for landing-page previews. */
export async function getFeaturedServices(
  db: Db = createSupabaseServerClient(),
): Promise<FeaturedService[]> {
  return listFeaturedServiceRows(db, FEATURED_LIMIT)
}

export type MenuCategory = MenuCategoryRow
export type MenuService = MenuCategoryRow["services"][number]

/**
 * The full public service menu: active categories (in `sort_order`) with their
 * active services embedded. Every active service is bookable via the in-house
 * engine; empty categories are dropped so the menu never renders a bare section.
 */
export async function getServiceMenu(
  db: Db = createSupabaseServerClient(),
): Promise<MenuCategory[]> {
  const categories = await listMenuCategories(db)

  return categories.filter((category) => category.services.length > 0)
}

export type PublicService = {
  id: string
  nameEn: string
  nameDk: string
  descriptionEn: string | null
  descriptionDk: string | null
  basePriceCents: number
  baseDurationMins: number
}

/** One active service by id, for its public detail page (null if missing). */
export async function getPublicService(
  id: string,
  db: Db = createSupabaseServerClient(),
): Promise<PublicService | null> {
  const data = await getPublicServiceRow(db, id)
  if (!data) {
    return null
  }

  return {
    id: data.id,
    nameEn: data.name_en,
    nameDk: data.name_dk,
    descriptionEn: data.description_en,
    descriptionDk: data.description_dk,
    basePriceCents: data.base_price_cents,
    baseDurationMins: data.base_duration_mins,
  }
}

export type ServiceAddon = {
  id: string
  name_en: string
  name_dk: string | null
  extra_price_cents: number
  extra_duration_mins: number
}

/** The bookable service shape the /book customise + confirm steps read. */
export type BookableService = MenuService

export type ServiceWithAddons = {
  service: BookableService
  addons: ServiceAddon[]
  /** Unordered incompatible pairs among this service's addons, by addon id. */
  incompatiblePairs: [string, string][]
}

/**
 * One bookable service plus its active add-ons (embedded, single round-trip)
 * and their incompatibility pairs — the data for the /book customise step.
 * Returns `null` for an unknown/archived service or a malformed id (callers
 * fall back to the service picker rather than 404ing the booking flow).
 */
export async function getServiceWithAddons(
  serviceId: string,
  db: Db = createSupabaseServerClient(),
): Promise<ServiceWithAddons | null> {
  if (!UUID_PATTERN.test(serviceId)) {
    return null
  }

  const data = await getBookableService(db, serviceId)
  if (!data) {
    return null
  }

  // Sort by price here — nested order isn't available through the double embed.
  const { service_addons, ...service } = data
  const addons = flattenServiceAddons<
    ServiceAddon & { archived_at: string | null }
  >(service_addons, { dropArchived: true }).sort(
    (a, b) => a.extra_price_cents - b.extra_price_cents,
  )

  const incompatiblePairs = await listIncompatiblePairsAmong(
    db,
    addons.map((addon) => addon.id),
  )

  return {
    service: service as BookableService,
    addons,
    incompatiblePairs,
  }
}
