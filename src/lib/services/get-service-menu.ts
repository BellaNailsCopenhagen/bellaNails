import type { SupabaseClient } from "@supabase/supabase-js"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/types"

type MenuService = Pick<
  Database["public"]["Tables"]["services"]["Row"],
  "id" | "name_en" | "name_dk" | "base_price_cents" | "base_duration_mins"
>

type MenuCategory = Pick<
  Database["public"]["Tables"]["categories"]["Row"],
  | "id"
  | "name_en"
  | "name_dk"
  | "description_en"
  | "description_dk"
  | "image_url"
> & { services: MenuService[] }

/**
 * The full public service menu: active categories (in `sort_order`) with their
 * active services embedded. Categories without a bookable service are dropped
 * so the menu never renders an empty section.
 *
 * As with the other catalog reads, the anon server client is created
 * internally by default; pass one in to share a client across reads.
 */
export async function getServiceMenu(
  supabase: SupabaseClient<Database> = createSupabaseServerClient(),
): Promise<MenuCategory[]> {
  const { data, error } = await supabase
    .from("categories")
    .select(
      "id, name_en, name_dk, description_en, description_dk, image_url, services(id, name_en, name_dk, base_price_cents, base_duration_mins, cal_event_slug)",
    )
    .is("archived_at", null)
    .is("services.archived_at", null)
    .order("sort_order", { ascending: true })
    .order("cal_event_id", { referencedTable: "services", ascending: true })

  if (error) {
    throw new Error(`Failed to load the service menu: ${error.message}`)
  }

  // A service with no Cal event slug isn't bookable — dropping it here keeps the
  // menu from linking into a booking flow that silently dead-ends at confirm.
  type RawCategory = Omit<MenuCategory, "services"> & {
    services: (MenuService & { cal_event_slug: string | null })[]
  }
  return ((data ?? []) as RawCategory[])
    .map((category) => ({
      ...category,
      services: category.services.filter((s) => s.cal_event_slug),
    }))
    .filter((category) => category.services.length > 0)
}

export type { MenuCategory, MenuService }
