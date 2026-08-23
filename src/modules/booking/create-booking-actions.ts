"use server"

import { revalidatePath } from "next/cache"

import type { Db, Insert } from "@/db/client"
import { insertBooking } from "@/db/bookings"
import { updateClientCommunicationLocale } from "@/db/clients"
import { getBookableService } from "@/db/services"
import { resolveLocale, type Locale } from "@/i18n/routing"
import { getAvailableSlots } from "@/modules/booking/availability"
import { manageUrlFor } from "@/modules/booking/manage-token"
import type { Slot } from "@/shared/booking-slots"
import { fetchClientContacts } from "@/modules/clients"
import { ensureUser } from "@/modules/identity/ensure-user"
import { requireOwner } from "@/modules/identity/require-owner"
import { sendBookingConfirmationEmail } from "@/modules/notifications/booking-email"
import { recordTermsAcceptance } from "@/modules/terms/acceptance"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"
import { BOOKING_STATUS } from "@/shared/booking-status"
import { EMAIL_PATTERN, toE164 } from "@/shared/contact-validation"
import { routes, revalidatePatterns } from "@/shared/routes"

const MIN = 60_000

export type CreateBookingInput = {
  serviceId: string
  addonIds: string[]
  start: string // ISO UTC — a slot from getAvailableSlots
  name: string
  email: string
  phone?: string
  notes?: string
  locale?: string
}

export type CreateBookingResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

type DraftInput = {
  serviceId: string
  addonIds: string[]
  start: string
  notes?: string
  locale?: string
}

type BookingDraft = {
  values: Omit<Insert<"bookings">, "client_id">
  service: { name_en: string; name_dk: string | null }
  addons: { name_en: string; name_dk: string | null }[]
  endIso: string
  totalPriceCents: number
}

/**
 * Shared core of both create paths: load the service, keep only its live
 * (non-archived) selected add-ons, re-validate the chosen slot by instant, and
 * assemble the insert (minus client_id) with the as-booked snapshot. Returns an
 * error the caller surfaces verbatim. `ignoreLeadTime` lets the owner path place
 * near-term slots; the exclusion constraint still guards the overlap race.
 */
async function prepareBooking(
  db: Db,
  input: DraftInput,
  ignoreLeadTime: boolean,
): Promise<{ ok: true; draft: BookingDraft } | { ok: false; error: string }> {
  const service = await getBookableService(db, input.serviceId).catch(() => null)
  if (!service) return { ok: false, error: "Service not found." }

  // Only add-ons that belong to this service and aren't archived.
  const addons = service.service_addons
    .map((sa) => sa.addons)
    .filter(
      (a): a is NonNullable<typeof a> =>
        !!a && !a.archived_at && input.addonIds.includes(a.id),
    )
  const durationMins =
    service.base_duration_mins +
    addons.reduce((sum, a) => sum + a.extra_duration_mins, 0)
  const totalPriceCents =
    service.base_price_cents +
    addons.reduce((sum, a) => sum + a.extra_price_cents, 0)

  const startMs = new Date(input.start).getTime()
  if (!Number.isFinite(startMs)) return { ok: false, error: "Pick a valid time." }
  const slots = await getAvailableSlots(input.serviceId, input.addonIds, db, {
    ignoreLeadTime,
  })
  if (!slots.some((s) => new Date(s.start).getTime() === startMs)) {
    return { ok: false, error: "That time isn't available — please pick another." }
  }
  const endIso = new Date(startMs + durationMins * MIN).toISOString()

  return {
    ok: true,
    draft: {
      service,
      addons,
      endIso,
      totalPriceCents,
      values: {
        status: BOOKING_STATUS.confirmed,
        start_time: input.start,
        end_time: endIso,
        total_price_cents: totalPriceCents,
        client_notes: input.notes?.trim() || null,
        // As-booked snapshot — a later catalog edit can't rewrite this booking.
        selected_addons: {
          serviceId: input.serviceId,
          addonIds: input.addonIds,
          totalDurationMins: durationMins,
          locale: input.locale ?? null,
          serviceNameEn: service.name_en,
          serviceNameDk: service.name_dk,
          addonSnapshots: addons.map((a) => ({
            id: a.id,
            nameEn: a.name_en,
            nameDk: a.name_dk,
          })),
        },
      },
    },
  }
}

// The client's confirmation email — best-effort (the sender swallows errors).
async function sendConfirmation(
  draft: BookingDraft,
  bookingId: string,
  to: string,
  firstName: string | null,
  startIso: string,
  locale: Locale,
): Promise<void> {
  const isEn = locale === "en"
  await sendBookingConfirmationEmail({
    to,
    firstName,
    serviceName: isEn
      ? draft.service.name_en
      : draft.service.name_dk ?? draft.service.name_en,
    addonNames: draft.addons.map((a) =>
      isEn ? a.name_en : a.name_dk ?? a.name_en,
    ),
    startIso,
    endIso: draft.endIso,
    priceCents: draft.totalPriceCents,
    manageUrl: manageUrlFor(locale, bookingId),
    bookingId,
    actor: "client",
    locale,
  })
}

const overlapMessage = (reason: "overlap" | "error") =>
  reason === "overlap"
    ? "That time was just taken — please pick another."
    : "Couldn't create the booking."

/**
 * Create an in-house booking. Public — a guest books by email (ensureUser
 * create-or-finds their client row). The slot is re-validated server-side and
 * the exclusion constraint guards the overlap race. Records service-terms
 * acceptance (best-effort). Public-abuse hardening (rate-limit / captcha) is
 * tracked in FOLLOWUPS before launch.
 */
export async function createBooking(
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  const email = input.email.trim().toLowerCase()
  if (!EMAIL_PATTERN.test(email)) return { ok: false, error: "Enter a valid email." }

  const db = createSupabaseServiceRoleClient()
  const prepared = await prepareBooking(db, input, false)
  if (!prepared.ok) return prepared
  const { draft } = prepared

  let clientId: string
  try {
    clientId = await ensureUser({
      email,
      name: input.name.trim() || undefined,
      // Store a clean E.164 number; fall back to the trimmed input if it can't
      // be normalised (it already passed the phone-pattern gate).
      phone: input.phone ? (toE164(input.phone) ?? input.phone.trim()) : undefined,
    })
  } catch {
    return { ok: false, error: "Couldn't save your details — please try again." }
  }

  const locale = resolveLocale(input.locale)
  // Remember the site locale so this client's future emails match — best-effort;
  // a pre-migration missing column must never fail the booking.
  try {
    await updateClientCommunicationLocale(db, clientId, locale)
  } catch {
    /* booking proceeds regardless */
  }

  const result = await insertBooking(db, { client_id: clientId, ...draft.values })
  if (!result.ok) return { ok: false, error: overlapMessage(result.reason) }

  await recordTermsAcceptance(db, {
    clientId,
    kind: "service",
    context: "booking",
    referenceId: result.id,
  })

  await sendConfirmation(
    draft,
    result.id,
    email,
    input.name.trim().split(/\s+/)[0] || null,
    input.start,
    locale,
  )

  revalidatePath(revalidatePatterns.publicAppointments, "page")
  return { ok: true, id: result.id }
}

export type OwnerCreateBookingInput = {
  // Book for an existing client by id, OR a new one by contact (email required).
  clientId?: string
  email?: string
  name?: string
  phone?: string
  serviceId: string
  addonIds: string[]
  start: string
  notes?: string
  locale?: string
}

/**
 * Owner books on a client's behalf (admin "New booking" / rebook). Owner-only,
 * and not bound by the public 24 h lead time — the studio can place near-term
 * slots. Books for an existing client by id, or create-or-finds one from the
 * given contact. The client still gets the confirmation email + manage link.
 */
export async function createBookingAsOwner(
  input: OwnerCreateBookingInput,
): Promise<CreateBookingResult> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "Not authorized." }

  const prepared = await prepareBooking(db, input, true)
  if (!prepared.ok) return prepared
  const { draft } = prepared

  // Resolve the client + who to email: an existing client, else a new one. An
  // existing client's saved locale wins; a new one gets the locale it booked in.
  const bookedLocale = resolveLocale(input.locale)
  let clientId: string
  let recipientEmail: string | null
  let firstName: string | null
  let emailLocale: Locale
  if (input.clientId) {
    clientId = input.clientId
    const contact = (await fetchClientContacts([clientId]))[clientId]
    recipientEmail = contact?.email ?? null
    firstName = contact?.firstName ?? null
    emailLocale = contact?.communicationLocale ?? bookedLocale
  } else {
    const email = input.email?.trim().toLowerCase() ?? ""
    if (!EMAIL_PATTERN.test(email)) return { ok: false, error: "Enter a valid client email." }
    try {
      clientId = await ensureUser({
        email,
        name: input.name?.trim() || undefined,
        phone: input.phone ? (toE164(input.phone) ?? input.phone.trim()) : undefined,
      })
    } catch {
      return { ok: false, error: "Couldn't save the client — please try again." }
    }
    recipientEmail = email
    firstName = input.name?.trim().split(/\s+/)[0] || null
    emailLocale = bookedLocale
  }

  const result = await insertBooking(db, { client_id: clientId, ...draft.values })
  if (!result.ok) return { ok: false, error: overlapMessage(result.reason) }

  // No service-terms record: the client didn't accept terms in an owner-placed
  // booking (unlike the public flow).
  // Confirmation to the client — skipped cleanly if there's no email on file.
  if (recipientEmail) {
    await sendConfirmation(
      draft,
      result.id,
      recipientEmail,
      firstName,
      input.start,
      emailLocale,
    )
  }

  revalidatePath(routes.admin.home)
  revalidatePath(routes.admin.appointments)
  revalidatePath(revalidatePatterns.adminClient, "page")
  revalidatePath(revalidatePatterns.publicAppointments, "page")
  return { ok: true, id: result.id }
}

/**
 * Owner-gated available slots for the admin "New booking" flow — the same
 * availability as the public picker but without the 24 h lead time, so the
 * studio can place near-term appointments. Returns [] when not the owner.
 */
export async function getOwnerSlots(
  serviceId: string,
  addonIds: string[],
): Promise<Slot[]> {
  const db = await requireOwner()
  if (!db) return []
  return getAvailableSlots(serviceId, addonIds, undefined, {
    ignoreLeadTime: true,
  })
}
