"use server"

import { getTranslations } from "next-intl/server"
import { revalidatePath } from "next/cache"

import { resolveLocale } from "@/i18n/routing"

import {
  claimTestimonial,
  getTestimonial,
  insertTestimonialRequest,
  updateTestimonial,
  type TestimonialRow,
} from "@/db/testimonials"
import type { Db } from "@/db/client"
import { getBookingOwner } from "@/db/bookings"
import { fetchClientContacts } from "@/modules/clients"
import { getCurrentUser } from "@/modules/identity/server"
import { requireOwner } from "@/modules/identity/require-owner"
import {
  recordCommunication,
  statusFromEmailResult,
} from "@/modules/notifications/communications"
import { notifyOwner } from "@/modules/notifications/notify"
import { sendTestimonialRequestEmail } from "@/modules/notifications/testimonial-email"
import { revalidateTestimonialSurfaces } from "@/modules/testimonials/revalidate"
import {
  testimonialUrlFor,
  verifyTestimonialToken,
} from "@/modules/testimonials/token"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"
import {
  TESTIMONIAL_CONSENT_VERSION,
  validateTestimonial,
} from "@/shared/testimonial"
import { routes, revalidatePatterns } from "@/shared/routes"

/**
 * Testimonials: the studio asks, the client writes, the studio chooses what shows.
 *
 * The two sides never cross. A client may only ever fill in their OWN requested
 * row and can never touch `visible`; only the owner can. That split is why the
 * home page can render straight from the table.
 */

export type TestimonialResult = { ok: true } | { ok: false; error: string }

const failed = (verb = "update") =>
  ({ ok: false, error: `Couldn’t ${verb} — please try again.` }) as const

// ─────────────────────────────────────────── the studio asks

export async function requestTestimonial(input: {
  clientId: string
  bookingId?: string
}): Promise<
  { ok: true; id: string; emailed: boolean } | { ok: false; error: string }
> {
  const db = await requireOwner()
  if (!db) {
    return { ok: false, error: "Not authorized." }
  }

  // Only attach a booking that is actually this client's.
  let bookingId: string | null = null
  if (input.bookingId) {
    const booking = await getBookingOwner(db, input.bookingId).catch(() => null)
    if (booking?.client_id === input.clientId) {
      bookingId = input.bookingId
    }
  }

  const saved = await insertTestimonialRequest(db, {
    client_id: input.clientId,
    booking_id: bookingId,
  })
  if (!saved.ok) {
    // The partial unique index allows one OPEN ask per client — a second is a
    // nag, not a feature.
    const duplicate = /duplicate key|unique constraint/i.test(saved.message)
    if (!duplicate) {
      console.error("[testimonial] request insert failed:", saved.message)
    }

    return duplicate
      ? {
          ok: false,
          error:
            "You've already asked this client — they still have an open invitation.",
        }
      : failed("send the invitation")
  }

  const contact = (await fetchClientContacts([input.clientId]))[input.clientId]
  let emailed = false
  if (contact?.email) {
    const locale = contact.communicationLocale
    const res = await sendTestimonialRequestEmail({
      to: contact.email,
      firstName: contact.firstName,
      locale,
      url: testimonialUrlFor(locale, saved.id),
    })
    emailed = res.ok
    await recordCommunication({
      clientId: input.clientId,
      // Same booking the row records, so the send shows against that appointment.
      bookingId,
      kind: "testimonial_request",
      trigger: "manual",
      recipient: contact.email,
      status: statusFromEmailResult(res),
      error: res.error,
    })
  }

  revalidatePath(revalidatePatterns.adminClient, "page")
  revalidatePath(routes.admin.testimonials)

  // The invitation exists either way — it shows in their My Space — but saying
  // "sent" when no mail went out would be a lie the studio acts on.
  return { ok: true, id: saved.id, emailed }
}

// ─────────────────────────────────────────── the client writes

/**
 * Submit from the signed link. The token identifies the row; the ROW's status is
 * the gate, so a used or declined invitation can't be filled in twice.
 */
export async function submitTestimonial(input: {
  /** The locale on screen, so a refusal comes back in it. */
  locale: string
  token: string
  authorName: string
  occupation?: string
  body: string
  /** Required — publication IS the purpose. Withdrawable at any time (Art. 7(3)). */
  consent: boolean
}): Promise<TestimonialResult> {
  const t = await getTranslations({
    locale: resolveLocale(input.locale),
    namespace: "testimonialForm",
  })

  const id = verifyTestimonialToken(input.token)
  if (!id) {
    return { ok: false, error: t("errLink") }
  }

  const checked = validateTestimonial(input)
  // The form validates too; this is the boundary, not the message.
  if (!checked.ok) {
    return { ok: false, error: t("errFields") }
  }

  const db = createSupabaseServiceRoleClient()
  const row = await getTestimonial(db, id)
  if (!row) {
    return { ok: false, error: t("errGone") }
  }
  if (row.status !== "requested") {
    return { ok: false, error: t("errUsed") }
  }

  // Whoever holds the emailed token may write, but a signed-in visitor must BE
  // the client — a consent record has to be authored by the person consenting.
  const user = await getCurrentUser()
  if (user && user.id !== row.client_id) {
    return { ok: false, error: t("errNotYours") }
  }

  const saved = await claimTestimonial(db, id, {
    status: "submitted",
    submitted_at: new Date().toISOString(),
    author_name: checked.value.authorName,
    occupation: checked.value.occupation,
    body: checked.value.body,
    // What they agreed to, so we can show it back to them later (Art. 7(1)).
    consent_version: TESTIMONIAL_CONSENT_VERSION,
    // Stays invisible until the studio chooses it. Never set from this side.
    visible: false,
  })
  if (!saved.ok) {
    return { ok: false, error: t("errUsed") }
  }

  await notifyOwner(db, {
    kind: "testimonial_submitted",
    clientId: row.client_id,
    targetId: id,
  })
  revalidatePath(routes.admin.testimonials)
  revalidatePath(routes.admin.home)

  return { ok: true }
}

// ─────────────────────────────────────────── the studio curates

/** The studio's switch. This is the ONLY thing that puts words on the home page. */
export async function setTestimonialVisible(
  id: string,
  visible: boolean,
): Promise<TestimonialResult> {
  const db = await requireOwner()
  if (!db) {
    return { ok: false, error: "Not authorized." }
  }

  const row = await getTestimonial(db, id)
  if (!row) {
    return { ok: false, error: "Not found." }
  }
  // A withdrawal is the client's right, so it is not the studio's to reverse.
  if (row.status === "withdrawn") {
    return {
      ok: false,
      error: "The client retracted permission — this can't be shown again.",
    }
  }
  if (row.status !== "submitted") {
    return {
      ok: false,
      error: "Nothing written yet — there's nothing to show.",
    }
  }

  const saved = await updateTestimonial(db, id, { visible })
  if (!saved.ok) {
    return failed()
  }

  revalidateTestimonialSurfaces()

  return { ok: true }
}

/** Close one out: an unanswered invitation, or words the studio won't be showing. */
export async function declineTestimonial(
  id: string,
): Promise<TestimonialResult> {
  const db = await requireOwner()
  if (!db) {
    return { ok: false, error: "Not authorized." }
  }

  const row = await getTestimonial(db, id)
  if (!row) {
    return { ok: false, error: "Not found." }
  }
  // A withdrawn or erased row is already unpublished by the client's own choice;
  // overwriting it with a curation status would erase that distinction.
  if (row.status !== "requested" && row.status !== "submitted") {
    return { ok: false, error: "This one is already closed." }
  }

  const saved = await updateTestimonial(db, id, {
    status: "declined",
    // Declining must also take it down, or the page keeps rendering it.
    visible: false,
    decided_at: new Date().toISOString(),
  })
  if (!saved.ok) {
    return failed()
  }

  revalidateTestimonialSurfaces()

  return { ok: true }
}

// ─────────────────────────────────────────── the client changes their mind

/** Their OWN row, or nothing. Each caller adds its own state gate. */
async function ownTestimonial(
  id: string,
): Promise<
  { ok: true; db: Db; row: TestimonialRow } | { ok: false; error: string }
> {
  const user = await getCurrentUser()
  if (!user) {
    return { ok: false, error: "Please sign in first." }
  }
  const db = createSupabaseServiceRoleClient()
  const row = await getTestimonial(db, id)
  if (!row || row.client_id !== user.id) {
    return { ok: false, error: "Not found." }
  }

  return { ok: true, db, row }
}

/**
 * Retract permission to publish. Per TESTIMONIAL — never per account — because
 * the granularity of withdrawal has to match the granularity of consent.
 *
 * The words are kept: they may change their mind, and the row is the record that
 * the publication we DID make was consented to. `eraseMyTestimonial` removes the
 * text for anyone who wants that too.
 */
export async function withdrawTestimonial(
  id: string,
): Promise<TestimonialResult> {
  const found = await ownTestimonial(id)
  if (!found.ok) {
    return found
  }
  if (found.row.status !== "submitted") {
    return { ok: false, error: "Nothing to change here." }
  }

  const saved = await updateTestimonial(found.db, id, {
    status: "withdrawn",
    // Overrides the studio's switch. A withdrawal is a right, not a preference.
    visible: false,
    withdrawn_at: new Date().toISOString(),
  })
  if (!saved.ok) {
    return failed()
  }

  revalidateTestimonialSurfaces()

  return { ok: true }
}

/**
 * Put it back. Re-granting has to be as easy as withdrawing, or the withdrawal
 * control becomes a one-way door people hesitate to use. It returns to
 * `submitted` and stays INVISIBLE — publication is the studio's call, as before.
 */
export async function restoreTestimonial(
  id: string,
): Promise<TestimonialResult> {
  const found = await ownTestimonial(id)
  if (!found.ok) {
    return found
  }
  // Erased words can't come back: there is nothing left to publish.
  if (found.row.status !== "withdrawn" || found.row.content_erased_at) {
    return { ok: false, error: "There's nothing to put back." }
  }

  const saved = await updateTestimonial(found.db, id, {
    status: "submitted",
    withdrawn_at: null,
    visible: false,
  })
  if (!saved.ok) {
    return failed()
  }

  revalidateTestimonialSurfaces()

  return { ok: true }
}

/**
 * Erase the words themselves (Art. 17). The row survives as a minimal shell —
 * dates, status and `consent_version`, no name, occupation or text — so the
 * consent record for the period we published still exists without keeping their
 * content. Implies withdrawal.
 */
export async function eraseMyTestimonial(
  id: string,
): Promise<TestimonialResult> {
  const found = await ownTestimonial(id)
  if (!found.ok) {
    return found
  }
  const { row } = found
  // Only words they actually wrote: erasing an unanswered invitation would
  // consume it, and erasing an already-erased row is a no-op worth refusing.
  if (!row.submitted_at || row.content_erased_at) {
    return { ok: false, error: "Nothing to erase here." }
  }

  const now = new Date().toISOString()
  const saved = await updateTestimonial(found.db, id, {
    // Keep whatever ended it — overwriting `declined` would credit the studio's
    // removal to the client.
    status: row.status === "submitted" ? "withdrawn" : row.status,
    visible: false,
    withdrawn_at: row.withdrawn_at ?? now,
    content_erased_at: now,
    author_name: null,
    occupation: null,
    body: null,
  })
  if (!saved.ok) {
    return failed("erase that")
  }

  revalidateTestimonialSurfaces()

  return { ok: true }
}
