import { TESTIMONIALS_DISPLAY_LIMIT } from "@/shared/testimonial"

import type { Db, Insert, Row, Update } from "./client"

/** `testimonials` — the client's own words, shown only once the studio flips
    `visible`. Separate from `reviews` (per-service, studio-entered, text+stars).
    Anon RLS exposes ONLY visible+submitted rows, so an unpublished testimonial is
    unreachable rather than merely unrendered. */

// The admin page renders every row, so its reads are bounded rather than growing
// with history.
const ADMIN_PAGE = 200

export type TestimonialRow = Row<"testimonials">

export async function insertTestimonialRequest(
  db: Db,
  values: Insert<"testimonials">,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { data, error } = await db
    .from("testimonials")
    .insert(values)
    .select("id")
    .single()
  if (error || !data) {
    return { ok: false, message: error?.message ?? "no row" }
  }

  return { ok: true, id: data.id }
}

export async function getTestimonial(
  db: Db,
  id: string,
): Promise<TestimonialRow | null> {
  const { data } = await db
    .from("testimonials")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  return data ?? null
}

export async function updateTestimonial(
  db: Db,
  id: string,
  values: Update<"testimonials">,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await db.from("testimonials").update(values).eq("id", id)

  return error ? { ok: false, message: error.message } : { ok: true }
}

/**
 * Fill in an invitation, but only while it is still open. The status predicate
 * makes this a compare-and-set: two tabs submitting the same token race here,
 * and exactly one wins. A plain update keyed on id alone would let the second
 * silently overwrite the first.
 */
export async function claimTestimonial(
  db: Db,
  id: string,
  values: Update<"testimonials">,
): Promise<{ ok: boolean }> {
  const { data } = await db
    .from("testimonials")
    .update(values)
    .eq("id", id)
    .eq("status", "requested")
    .select("id")

  return { ok: (data?.length ?? 0) > 0 }
}

/** The home section's read — published only, the studio's ordering first.
    Anon-safe twice over: RLS narrows the rows, and the column list matches the
    column-level grant to `anon`, so `client_id` is unreachable, not just unused. */
export async function listVisibleTestimonials(
  db: Db,
  limit = TESTIMONIALS_DISPLAY_LIMIT,
): Promise<
  Pick<TestimonialRow, "id" | "author_name" | "occupation" | "body">[]
> {
  const { data } = await db
    .from("testimonials")
    .select("id, author_name, occupation, body")
    .eq("visible", true)
    .eq("status", "submitted")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("submitted_at", { ascending: false })
    .limit(limit)

  return data ?? []
}

/** The curation queue: everything the client actually WROTE, newest first,
    visible or not — including ones since taken down or removed, so a
    disappearance from the home page is explained rather than mysterious.
    `submitted_at` is the test, not the status: an invitation the studio withdrew
    unanswered is `declined` too, and it belongs in the pending list, not here. */
export async function listWrittenTestimonials(
  db: Db,
  limit = ADMIN_PAGE,
): Promise<TestimonialRow[]> {
  const { data, error } = await db
    .from("testimonials")
    .select("*")
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(limit)
  if (error) {
    throw new Error(`testimonials: ${error.message}`)
  }

  return data ?? []
}

/** Asks still waiting on a client, so the studio doesn't re-ask. */
export async function listOpenTestimonialRequests(
  db: Db,
  limit = ADMIN_PAGE,
): Promise<TestimonialRow[]> {
  const { data, error } = await db
    .from("testimonials")
    .select("*")
    .eq("status", "requested")
    .order("requested_at", { ascending: true })
    .limit(limit)
  if (error) {
    throw new Error(`testimonials: ${error.message}`)
  }

  return data ?? []
}

/** A client's own rows — My Space, and the DSAR export. */
export async function listTestimonialsForClient(
  db: Db,
  clientId: string,
): Promise<TestimonialRow[]> {
  const { data, error } = await db
    .from("testimonials")
    .select("*")
    .eq("client_id", clientId)
    .order("requested_at", { ascending: false })
  // A client's own words carry their withdraw/erase controls — silently
  // returning [] would make a data right disappear.
  if (error) {
    throw new Error(`testimonials: ${error.message}`)
  }

  return data ?? []
}

/** GDPR erasure — their name, occupation and words are all theirs. */
export async function deleteTestimonialsForClient(
  db: Db,
  clientId: string,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await db
    .from("testimonials")
    .delete()
    .eq("client_id", clientId)

  return error ? { ok: false, message: error.message } : { ok: true }
}
