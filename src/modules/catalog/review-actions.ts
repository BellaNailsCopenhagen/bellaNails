"use server"

import { revalidatePath } from "next/cache"

import { deleteReview as deleteReviewRow, insertReview } from "@/db/reviews"
import { requireOwner } from "@/lib/admin/require-owner"

export type ReviewResult = { ok: true } | { ok: false; error: string }

/** Testimonials are studio-entered, so there is no author authorization —
    only the owner check. */
export async function addReview(
  serviceId: string,
  input: { authorName: string; body: string; rating: number | null },
): Promise<ReviewResult> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "unauthorized" }

  const body = input.body.trim()
  if (body.length < 2) return { ok: false, error: "Review text is required." }
  const rating =
    input.rating && input.rating >= 1 && input.rating <= 5 ? input.rating : null

  const saved = await insertReview(db, {
    service_id: serviceId,
    author_name: input.authorName.trim() || null,
    body,
    rating,
  })
  if (!saved.ok) return { ok: false, error: "Couldn’t save the review." }

  revalidatePath(`/admin/services/${serviceId}`)
  return { ok: true }
}

export async function deleteReview(reviewId: string): Promise<ReviewResult> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "unauthorized" }

  const removed = await deleteReviewRow(db, reviewId)
  if (!removed.ok) return { ok: false, error: "Couldn’t remove the review." }

  revalidatePath(`/admin/services/${removed.serviceId}`)
  return { ok: true }
}
