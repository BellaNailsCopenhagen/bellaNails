import "server-only"

import { listIncompatiblePairsAmong } from "@/db/addon-incompatibilities"
import type { Db, Insert } from "@/db/client"
import { getSlotsForDuration } from "@/modules/booking/availability"
import {
  resolveBookingSubject,
  type BookingSubject,
} from "@/modules/booking/subject"
import { BOOKING_STATUS } from "@/shared/booking-status"
import type { SubjectRef } from "@/shared/booking-subject"

const MIN = 60_000

export type BookingDraft = {
  values: Omit<Insert<"bookings">, "client_id">
  /** What is being booked, already resolved — callers read names/price off this
      rather than re-loading the service. */
  subject: BookingSubject
  endIso: string
}

export type DraftInput = {
  ref: SubjectRef
  start: string
  notes?: string
  locale?: string
}

/**
 * Resolve the subject (catalog service + live add-ons, or a one-time offer),
 * compute the end, and assemble the insert (minus client_id) with the as-booked
 * snapshot. Shared by both create paths AND the booking-REQUEST path.
 *
 * `checkSlot` (default true) re-validates the chosen instant against
 * availability — the request path turns it OFF, since the whole point is a slot
 * the engine won't offer (outside hours / past the cap). `ignoreLeadTime` lets
 * the owner path place near-term slots; the exclusion constraint still guards
 * the overlap race at insert.
 */
export async function buildBookingDraft(
  db: Db,
  input: DraftInput,
  opts: { checkSlot?: boolean; ignoreLeadTime?: boolean; now?: number } = {},
): Promise<{ ok: true; draft: BookingDraft } | { ok: false; error: string }> {
  const { checkSlot = true, ignoreLeadTime = false } = opts

  const resolved = await resolveBookingSubject(db, input.ref, { now: opts.now })
  if (!resolved.ok) return resolved
  const { subject } = resolved

  // Fail closed on an incompatible combo — the picker disables clashers, but the
  // server must never trust the client and persist an invalid pair.
  if (subject.addons.length > 1) {
    try {
      const clashes = await listIncompatiblePairsAmong(
        db,
        subject.addons.map((a) => a.id),
      )
      if (clashes.length > 0) {
        return {
          ok: false,
          error: "Those add-ons can’t be combined — please adjust your selection.",
        }
      }
    } catch {
      return { ok: false, error: "Couldn’t validate the add-ons — please try again." }
    }
  }

  const startMs = new Date(input.start).getTime()
  if (!Number.isFinite(startMs)) return { ok: false, error: "Pick a valid time." }

  if (checkSlot) {
    const slots = await getSlotsForDuration(subject.durationMins, db, {
      ignoreLeadTime,
    })
    if (!slots.some((s) => new Date(s.start).getTime() === startMs)) {
      return { ok: false, error: "That time isn't available — please pick another." }
    }
  }
  const endIso = new Date(startMs + subject.durationMins * MIN).toISOString()

  return {
    ok: true,
    draft: {
      subject,
      endIso,
      values: {
        status: BOOKING_STATUS.confirmed,
        start_time: input.start,
        end_time: endIso,
        total_price_cents: subject.priceCents,
        client_notes: input.notes?.trim() || null,
        selected_addons: snapshotOf(subject, input.locale),
      },
    },
  }
}

/** The AS-BOOKED snapshot — a later catalog edit, or a withdrawn offer, can
    never rewrite this booking. `serviceId` stays null for an offer, which is
    exactly what makes an offer booking non-rebookable in the client's history. */
function snapshotOf(subject: BookingSubject, locale: string | undefined) {
  const { ref } = subject
  const ids =
    ref.kind === "offer"
      ? { serviceId: null, offerId: ref.offerId, addonIds: [] as string[] }
      : { serviceId: ref.serviceId, offerId: null, addonIds: ref.addonIds }
  return {
    ...ids,
    totalDurationMins: subject.durationMins,
    locale: locale ?? null,
    serviceNameEn: subject.nameEn,
    serviceNameDk: subject.nameDk,
    addonSnapshots: subject.addons.map((a) => ({
      id: a.id,
      nameEn: a.name_en,
      nameDk: a.name_dk,
    })),
  }
}
