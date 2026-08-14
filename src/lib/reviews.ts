import type { SupabaseClient } from "@supabase/supabase-js"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/types"

type Client = SupabaseClient<Database>

export type Review = {
  id: string
  authorName: string | null
  body: string
  rating: number | null
  createdAt: string
}

/** Reviews for a service, newest first. Public read (degrades to [] on error). */
export async function getServiceReviews(
  serviceId: string,
  supabase: Client = createSupabaseServerClient(),
): Promise<Review[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("id, author_name, body, rating, created_at")
    .eq("service_id", serviceId)
    .order("created_at", { ascending: false })
  if (error || !data) return []
  return data.map((r) => ({
    id: r.id,
    authorName: r.author_name,
    body: r.body,
    rating: r.rating,
    createdAt: r.created_at,
  }))
}
