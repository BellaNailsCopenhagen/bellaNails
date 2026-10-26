import type { Db, Row } from "./client"

/** `reviews` — studio-entered testimonials attached to a service. */

export type ReviewRow = Pick<
  Row<"reviews">,
  "id" | "author_name" | "body" | "rating" | "created_at"
>

export async function listReviewsForService(
  db: Db,
  serviceId: string,
): Promise<ReviewRow[]> {
  const { data, error } = await db
    .from("reviews")
    .select("id, author_name, body, rating, created_at")
    .eq("service_id", serviceId)
    .order("created_at", { ascending: false })
  if (error) {
    return []
  }

  return data ?? []
}

export async function insertReview(
  db: Db,
  values: {
    service_id: string
    author_name: string | null
    body: string
    rating: number | null
  },
): Promise<{ ok: boolean }> {
  const { error } = await db.from("reviews").insert(values)

  return { ok: !error }
}

/** Delete a review, returning the service it belonged to so the caller can
    revalidate that service's page. */
export async function deleteReview(
  db: Db,
  reviewId: string,
): Promise<{ ok: true; serviceId: string } | { ok: false }> {
  const { data, error } = await db
    .from("reviews")
    .delete()
    .eq("id", reviewId)
    .select("service_id")
    .single()
  if (error || !data) {
    return { ok: false }
  }

  return { ok: true, serviceId: data.service_id }
}
