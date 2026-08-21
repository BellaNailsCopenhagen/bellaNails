"use server"

import { revalidatePath } from "next/cache"

import { insertBooking } from "@/db/bookings"
import { getBookableService } from "@/db/services"
import { getAvailableSlots } from "@/modules/booking/availability"
import { ensureUser } from "@/modules/identity/ensure-user"
import { recordTermsAcceptance } from "@/modules/terms/acceptance"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"
import { BOOKING_STATUS } from "@/shared/booking-status"

const MIN = 60_000
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

/**
 * Create an in-house booking (replaces the Cal flow). Public — a guest books by
 * email (ensureUser create-or-finds their client row). The slot is re-validated
 * server-side (never trust the client) and the exclusion constraint guards the
 * overlap race. Booking a session records service-terms acceptance (best-effort:
 * a no-op if no terms are published yet — mirrors the Cal flow).
 *
 * NOTE — not yet wired to a UI. In-house bookings leave the Cal columns
 * (cal_booking_id / cal_uid / cancel_url / reschedule_url) NULL, so Phase 3b MUST
 * make those Row types nullable and update the appointment cards (cancel /
 * reschedule become in-house actions, not Cal URLs; the React key must not use
 * cal_booking_id) before wiring a caller. Public-abuse hardening (rate-limit /
 * captcha) is tracked in FOLLOWUPS before launch.
 */
export async function createBooking(
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  const email = input.email.trim().toLowerCase()
  if (!EMAIL.test(email)) return { ok: false, error: "Enter a valid email." }

  const db = createSupabaseServiceRoleClient()
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

  // Re-validate the slot against real availability (studio hours, lead time,
  // existing bookings) — compare by instant, not string form. The exclusion
  // constraint then guards the final overlap race at insert.
  const startMs = new Date(input.start).getTime()
  if (!Number.isFinite(startMs)) return { ok: false, error: "Pick a valid time." }
  const slots = await getAvailableSlots(input.serviceId, input.addonIds, db)
  if (!slots.some((s) => new Date(s.start).getTime() === startMs)) {
    return { ok: false, error: "That time isn't available — please pick another." }
  }
  const end = new Date(startMs + durationMins * MIN)

  let clientId: string
  try {
    clientId = await ensureUser({
      email,
      name: input.name.trim() || undefined,
      phone: input.phone,
    })
  } catch {
    return { ok: false, error: "Couldn't save your details — please try again." }
  }

  const result = await insertBooking(db, {
    client_id: clientId,
    status: BOOKING_STATUS.confirmed,
    start_time: input.start,
    end_time: end.toISOString(),
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
  })
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "overlap"
          ? "That time was just taken — please pick another."
          : "Couldn't create the booking.",
    }
  }

  await recordTermsAcceptance(db, {
    clientId,
    kind: "service",
    context: "booking",
    referenceId: result.id,
  })
  revalidatePath("/[locale]/appointments", "page")
  return { ok: true, id: result.id }
}
