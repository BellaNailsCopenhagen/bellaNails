import type { Db } from "@/db/client"
import { getWeeklyHours } from "@/db/studio-hours"
import { listSpecialDays, type SpecialDayRow } from "@/db/studio-special-days"
import { createSupabaseServerClient } from "@/platform/supabase/server"
import type { SpecialDay, StudioHours, TimeRange, WeeklyHours } from "@/shared/studio-hours"

type Client = Db
type SpecialRow = SpecialDayRow

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
  const [weekly, special] = await Promise.all([
    getWeeklyHours(supabase),
    listSpecialDays(supabase),
  ])
  return {
    weekly: (weekly as WeeklyHours) ?? {},
    special: special.map(toSpecialDay),
  }
}
