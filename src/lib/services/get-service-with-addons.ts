import type { SupabaseClient } from "@supabase/supabase-js"

import { createSupabaseServerClient } from "@/platform/supabase/server"
import type { MenuService } from "@/lib/services/get-service-menu"
import {
  fetchIncompatiblePairs,
  flattenServiceAddons,
} from "@/lib/services/service-addons"
import type { Database } from "@/platform/supabase/types"

type ServiceAddon = Pick<
  Database["public"]["Tables"]["addons"]["Row"],
  "id" | "name_en" | "name_dk" | "extra_price_cents" | "extra_duration_mins"
>

/** Menu columns plus the Cal.com identity the confirm step embeds with. */
type BookableService = MenuService &
  Pick<
    Database["public"]["Tables"]["services"]["Row"],
    "cal_event_id" | "cal_event_slug"
  >

type ServiceWithAddons = {
  service: BookableService
  addons: ServiceAddon[]
  /** Unordered incompatible pairs among this service's addons, by addon id. */
  incompatiblePairs: [string, string][]
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * One bookable service plus its active add-ons (embedded, single round-trip)
 * and their incompatibility pairs — the data for the /book customise step.
 * Returns `null` for an unknown/archived service or a malformed id (callers
 * fall back to the service picker rather than 404ing the booking flow).
 */
export async function getServiceWithAddons(
  serviceId: string,
  supabase: SupabaseClient<Database> = createSupabaseServerClient(),
): Promise<ServiceWithAddons | null> {
  if (!UUID_PATTERN.test(serviceId)) return null

  const { data, error } = await supabase
    .from("services")
    .select(
      "id, name_en, name_dk, base_price_cents, base_duration_mins, cal_event_id, cal_event_slug, service_addons(addons(id, name_en, name_dk, extra_price_cents, extra_duration_mins, archived_at))",
    )
    .eq("id", serviceId)
    .is("archived_at", null)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load service add-ons: ${error.message}`)
  }
  if (!data) return null

  // Add-ons are linked via the service_addons join now; flatten, drop archived,
  // and sort by price here (nested filters/order aren't available through the
  // double embed).
  const { service_addons, ...service } = data as unknown as BookableService & {
    service_addons: { addons: (ServiceAddon & { archived_at: string | null }) | null }[]
  }
  const addons: ServiceAddon[] = flattenServiceAddons<
    ServiceAddon & { archived_at: string | null }
  >(service_addons, { dropArchived: true }).sort(
    (a, b) => a.extra_price_cents - b.extra_price_cents,
  )

  const incompatiblePairs = await fetchIncompatiblePairs(
    supabase,
    addons.map((addon) => addon.id),
  )

  return { service, addons, incompatiblePairs }
}

export type { BookableService, ServiceAddon, ServiceWithAddons }
