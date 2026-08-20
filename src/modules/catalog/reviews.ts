import type { Db } from "@/db/client"
import { listReviewsForService } from "@/db/reviews"
import { createSupabaseServerClient } from "@/platform/supabase/server"

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
  db: Db = createSupabaseServerClient(),
): Promise<Review[]> {
  const rows = await listReviewsForService(db, serviceId)
  return rows.map((r) => ({
    id: r.id,
    authorName: r.author_name,
    body: r.body,
    rating: r.rating,
    createdAt: r.created_at,
  }))
}
