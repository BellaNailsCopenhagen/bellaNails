import "server-only"

import { listIncompatiblePairsAmong } from "@/db/addon-incompatibilities"
import type { Db, Insert } from "@/db/client"
import { getBookableService } from "@/db/services"
import { getAvailableSlots } from "@/modules/booking/availability"
import { BOOKING_STATUS } from "@/shared/booking-status"

const MIN = 60_000

export type BookingDraft = {
  values: Omit<Insert<"bookings">, "client_id">
  service: { name_en: string; name_dk: string | null }
  addons: { name_en: string; name_dk: string | null }[]
  endIso: string
  totalPriceCents: number
}

export type DraftInput = {
  serviceId: string
  addonIds: string[]
  start: string
  notes?: string
  locale?: string
}

/**
 * Load the service + its live (non-archived) selected add-ons, reject an
 * incompatible combo, compute duration/price/end, and assemble the insert (minus
 * client_id) with the as-booked snapshot. Shared by both create paths AND the
 * booking-REQUEST path. `checkSlot` (default true) re-validates the chosen instant
 * against availability — the request path turns it OFF, since the whole point is
 * a slot the engine won't offer (outside hours / past the cap). `ignoreLeadTime`
 * lets the owner path place near-term slots; the exclusion constraint still
 * guards the overlap race at insert.
 */
export async function buildBookingDraft(
  db: Db,
  input: DraftInput,
  opts: { checkSlot?: boolean; ignoreLeadTime?: boolean } = {},
): Promise<{ ok: true; draft: BookingDraft } | { ok: false; error: string }> {
  const { checkSlot = true, ignoreLeadTime = false } = opts

  const service = await getBookableService(db, input.serviceId).catch(() => null)
  if (!service) return { ok: false, error: "Service not found." }

  const addons = service.service_addons
    .map((sa) => sa.addons)
    .filter(
      (a): a is NonNullable<typeof a> =>
        !!a && !a.archived_at && input.addonIds.includes(a.id),
    )

  // Fail closed on an incompatible add-on combo — the picker disables clashers,
  // but the server must never trust the client and persist an invalid pair.
  try {
    const clashes = await listIncompatiblePairsAmong(db, addons.map((a) => a.id))
    if (clashes.length > 0) {
      return { ok: false, error: "Those add-ons can’t be combined — please adjust your selection." }
    }
  } catch {
    return { ok: false, error: "Couldn’t validate the add-ons — please try again." }
  }

  const durationMins =
    service.base_duration_mins +
    addons.reduce((sum, a) => sum + a.extra_duration_mins, 0)
  const totalPriceCents =
    service.base_price_cents +
    addons.reduce((sum, a) => sum + a.extra_price_cents, 0)

  const startMs = new Date(input.start).getTime()
  if (!Number.isFinite(startMs)) return { ok: false, error: "Pick a valid time." }
  if (checkSlot) {
    const slots = await getAvailableSlots(input.serviceId, input.addonIds, db, {
      ignoreLeadTime,
    })
    if (!slots.some((s) => new Date(s.start).getTime() === startMs)) {
      return { ok: false, error: "That time isn't available — please pick another." }
    }
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
