"use server"

import { revalidatePath } from "next/cache"

import { requireOwner } from "@/lib/admin/require-owner"

export type ReviewResult = { ok: true } | { ok: false; error: string }

export async function addReview(
  serviceId: string,
  input: { authorName: string; body: string; rating: number | null },
): Promise<ReviewResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const body = input.body.trim()
  if (body.length < 2) return { ok: false, error: "Review text is required." }
  const rating =
    input.rating && input.rating >= 1 && input.rating <= 5 ? input.rating : null

  const { error } = await supabase.from("reviews").insert({
    service_id: serviceId,
    author_name: input.authorName.trim() || null,
    body,
    rating,
  })
  if (error) return { ok: false, error: "Couldn’t save the review." }

  revalidatePath(`/admin/services/${serviceId}`)
  return { ok: true }
}

export async function deleteReview(reviewId: string): Promise<ReviewResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const { data, error } = await supabase
    .from("reviews")
    .delete()
    .eq("id", reviewId)
    .select("service_id")
    .single()
  if (error || !data) return { ok: false, error: "Couldn’t remove the review." }

  revalidatePath(`/admin/services/${data.service_id}`)
  return { ok: true }
}
