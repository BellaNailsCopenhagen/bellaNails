import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MenuService } from "@/lib/services/get-service-menu";
import type { Database } from "@/lib/supabase/types";

type ServiceAddon = Pick<
  Database["public"]["Tables"]["addons"]["Row"],
  "id" | "name_en" | "name_dk" | "extra_price_cents" | "extra_duration_mins"
>;

/** Menu columns plus the Cal.com identity the confirm step embeds with. */
type BookableService = MenuService &
  Pick<
    Database["public"]["Tables"]["services"]["Row"],
    "cal_event_id" | "cal_event_slug"
  >;

type ServiceWithAddons = {
  service: BookableService;
  addons: ServiceAddon[];
  /** Unordered incompatible pairs among this service's addons, by addon id. */
  incompatiblePairs: [string, string][];
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (!UUID_PATTERN.test(serviceId)) return null;

  const { data, error } = await supabase
    .from("services")
    .select(
      "id, name_en, name_dk, base_price_cents, base_duration_mins, cal_event_id, cal_event_slug, addons(id, name_en, name_dk, extra_price_cents, extra_duration_mins)",
    )
    .eq("id", serviceId)
    .is("archived_at", null)
    .is("addons.archived_at", null)
    .order("extra_price_cents", { referencedTable: "addons", ascending: true })
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load service add-ons: ${error.message}`);
  }
  if (!data) return null;

  const { addons, ...service } = data as BookableService & {
    addons: ServiceAddon[];
  };

  let incompatiblePairs: [string, string][] = [];
  if (addons.length > 1) {
    const addonIds = addons.map((addon) => addon.id);
    // Both endpoints constrained in the query, so only this service's pairs
    // come back — no client-side re-filtering needed.
    const { data: pairs, error: pairsError } = await supabase
      .from("addon_incompatibilities")
      .select("addon_id_a, addon_id_b")
      .in("addon_id_a", addonIds)
      .in("addon_id_b", addonIds);

    if (pairsError) {
      throw new Error(
        `Failed to load add-on incompatibilities: ${pairsError.message}`,
      );
    }

    incompatiblePairs = (pairs ?? []).map((pair) => [
      pair.addon_id_a,
      pair.addon_id_b,
    ]);
  }

  return { service, addons, incompatiblePairs };
}

export type { BookableService, ServiceAddon, ServiceWithAddons };
