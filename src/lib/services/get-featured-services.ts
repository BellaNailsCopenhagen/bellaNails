import type { SupabaseClient } from "@supabase/supabase-js"

import { createSupabaseServerClient } from "@/platform/supabase/server"
import type { Database } from "@/platform/supabase/types"

type FeaturedService = Pick<
  Database["public"]["Tables"]["services"]["Row"],
  | "id"
  | "name_en"
  | "name_dk"
  | "description_en"
  | "description_dk"
  | "base_price_cents"
  | "base_duration_mins"
>

/**
 * Public featured services for landing-page previews.
 *
 * By default this creates the anon server client internally, which is the
 * normal RSC pattern in this codebase. Accepting an optional client makes it
 * easy to reuse a single client instance when one request performs multiple
 * Supabase reads.
 */
export async function getFeaturedServices(
  supabase: SupabaseClient<Database> = createSupabaseServerClient(),
): Promise<FeaturedService[]> {
  const { data, error } = await supabase
    .from("services")
    .select(
      "id, name_en, name_dk, description_en, description_dk, base_price_cents, base_duration_mins",
    )
    .eq("is_featured", true)
    .is("archived_at", null)
    .order("cal_event_id", { ascending: true })
    .limit(3)

  if (error) {
    throw new Error(`Failed to load featured services: ${error.message}`)
  }

  return (data ?? []) as FeaturedService[]
}

export type { FeaturedService }
