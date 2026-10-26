import "server-only"

import type { Db } from "@/db/client"
import {
  getTestimonial,
  listOpenTestimonialRequests,
  listWrittenTestimonials,
  listTestimonialsForClient,
  listVisibleTestimonials,
  type TestimonialRow,
} from "@/db/testimonials"
import { fetchClientContacts } from "@/modules/clients"
import { getCurrentUser } from "@/modules/identity/server"
import { requireOwner } from "@/modules/identity/require-owner"
import {
  signTestimonialToken,
  verifyTestimonialToken,
} from "@/modules/testimonials/token"
import {
  createAuthedSupabaseServerClient,
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/platform/supabase/server"
import type { ClientContact } from "@/shared/contact"
import {
  asTestimonialStatus,
  testimonialState,
  type PublishedTestimonial,
  type TestimonialState,
  type TestimonialStatus,
} from "@/shared/testimonial"

const errorOf = (error: unknown) =>
  error instanceof Error ? error.message : error

/**
 * The home section's content. Anon client on purpose — the RLS policy already
 * narrows to visible + submitted, so this stays static-render friendly and can
 * never leak an unpublished draft. Degrades to [] rather than taking the page
 * down; the section simply doesn't render.
 */

export async function getPublishedTestimonials(
  db?: Db,
): Promise<PublishedTestimonial[]> {
  try {
    // Inside the try: assertEnv throws, and a missing key must not take the
    // prerendered home page down.
    const rows = await listVisibleTestimonials(
      db ?? createSupabaseServerClient(),
    )

    return rows.flatMap((row) =>
      row.author_name && row.body
        ? [
            {
              id: row.id,
              authorName: row.author_name,
              occupation: row.occupation,
              body: row.body,
            },
          ]
        : [],
    )
  } catch (error) {
    console.error("[testimonials] load failed", errorOf(error))

    return []
  }
}

/**
 * What is behind an invitation link — the one question the public page asks.
 * Returns null for a bad signature or a vanished row; an already-used or
 * withdrawn invitation still resolves, so the page can explain itself instead of
 * showing a second form.
 */
export async function getTestimonialInviteByToken(
  token: string,
): Promise<{ status: TestimonialStatus; answered: boolean } | null> {
  const id = verifyTestimonialToken(token)
  if (!id) {
    return null
  }
  const row = await getTestimonial(createSupabaseServiceRoleClient(), id).catch(
    () => null,
  )

  return row
    ? {
        status: asTestimonialStatus(row.status),
        answered: Boolean(row.submitted_at),
      }
    : null
}

/** One row as the admin list shows it — the words plus who wrote them. */
export type AdminTestimonial = {
  id: string
  clientId: string
  state: TestimonialState
  visible: boolean
  authorName: string | null
  occupation: string | null
  body: string | null
  requestedAt: string
  submittedAt: string | null
}

const toAdmin = (row: TestimonialRow): AdminTestimonial => ({
  id: row.id,
  clientId: row.client_id,
  state: testimonialState(row),
  visible: row.visible,
  authorName: row.author_name,
  occupation: row.occupation,
  body: row.body,
  requestedAt: row.requested_at,
  submittedAt: row.submitted_at,
})

/**
 * The curation page: what has been written (visible or not), and who still owes
 * the studio one. Contacts come along so a row can name the person even before they
 * have typed their own name.
 */
export async function getTestimonialsForAdmin(): Promise<{
  submitted: AdminTestimonial[]
  pending: AdminTestimonial[]
  contacts: Record<string, ClientContact>
}> {
  const empty = { submitted: [], pending: [], contacts: {} }
  const db = await requireOwner()
  if (!db) {
    return empty
  }
  try {
    const [submitted, pending] = await Promise.all([
      listWrittenTestimonials(db),
      listOpenTestimonialRequests(db),
    ])
    const contacts = await fetchClientContacts([
      ...new Set([...submitted, ...pending].map((r) => r.client_id)),
    ])

    return {
      submitted: submitted.map(toAdmin),
      pending: pending.map(toAdmin),
      contacts,
    }
  } catch (error) {
    console.error("[testimonials] admin load failed", errorOf(error))

    return empty
  }
}

/** A testimonial as its AUTHOR sees it in My Space. */
export type MyTestimonial = {
  id: string
  state: TestimonialState
  authorName: string | null
  occupation: string | null
  body: string | null
}

/** An open invitation, with the signed link that opens the form. */
export type MyTestimonialInvite = { id: string; token: string }

/**
 * Everything My Space needs about this client's testimonials, in ONE read: the
 * open invitation (if any) and the words they have already written. They come
 * from the same query because they are a partition of the same rows.
 */
export async function getMyTestimonialSpace(): Promise<{
  invite: MyTestimonialInvite | null
  items: MyTestimonial[]
}> {
  const empty = { invite: null, items: [] }
  const user = await getCurrentUser()
  if (!user) {
    return empty
  }
  try {
    const db = await createAuthedSupabaseServerClient()
    const rows = await listTestimonialsForClient(db, user.id)
    const open = rows.find((row) => row.status === "requested")

    return {
      invite: open
        ? { id: open.id, token: signTestimonialToken(open.id) }
        : null,
      // `submitted_at` is the honest test for "they wrote something": an
      // invitation the studio withdrew before it was answered has none, and
      // must not appear as a testimonial with nothing in it.
      items: rows
        .filter((row) => row.submitted_at)
        .map((row) => ({
          id: row.id,
          state: testimonialState(row),
          authorName: row.author_name,
          occupation: row.occupation,
          body: row.body,
        })),
    }
  } catch (error) {
    console.error("[testimonials] my space load failed", errorOf(error))

    return empty
  }
}
