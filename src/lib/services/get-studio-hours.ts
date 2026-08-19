import type { SupabaseClient } from "@supabase/supabase-js"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/types"
import type { SpecialDay, StudioHours, TimeRange, WeeklyHours } from "@/lib/studio-hours"

type Client = SupabaseClient<Database>
type SpecialRow = Database["public"]["Tables"]["studio_special_days"]["Row"]

function toSpecialDay(row: SpecialRow): SpecialDay {
  return {
    id: row.id,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    closed: row.closed,
    hours: (row.hours as TimeRange[] | null) ?? null,
    label: row.label,
  }
}

/** The full studio schedule — weekly config + special days. Public-read;
    degrades to empty if the tables aren't applied yet. */
export async function getStudioHours(
  supabase: Client = createSupabaseServerClient(),
): Promise<StudioHours> {
  const [{ data: config }, { data: special }] = await Promise.all([
    supabase.from("studio_hours").select("weekly").eq("id", true).maybeSingle(),
    supabase.from("studio_special_days").select("*").order("starts_on"),
  ])
  return {
    weekly: (config?.weekly as WeeklyHours) ?? {},
    special: (special ?? []).map(toSpecialDay),
  }
}
