import { resolveLocale } from "@/i18n/routing"
import { metaOf } from "@/shared/booking-policy"
import { getServiceWithAddons } from "@/modules/catalog"
import { localizeSelection } from "@/shared/localize-selection"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"
import { getBookingRecap } from "@/db/bookings"
import type { BookingLineItem } from "@/shared/booking-totals"

/**
 * Booking recap by row id — the read path for /confirmation, where the booker is
 * usually signed out and RLS would hide the row. The booking id is an
 * unguessable capability token, so possession of the link authorizes this read.
 * The response is sanitized: schedule + localized catalog line items only — no
 * client_id, no PII (we store none here).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type BookingRecap = {
  status: string
  startTime: string
  endTime: string
  /** Null when the catalog no longer resolves (archived service, transient
      catalog error) — the page then shows schedule only and degrades
      gracefully. */
  selection: { service: BookingLineItem; addons: BookingLineItem[] } | null
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!UUID.test(id)) {
    return Response.json({ error: "not found" }, { status: 404 })
  }

  const search = new URL(request.url).searchParams
  const supabase = createSupabaseServiceRoleClient()

  const locale = resolveLocale(search.get("locale"))
  let booking
  try {
    booking = await getBookingRecap(supabase, id)
  } catch (error) {
    console.error("[bookings-recap] read failed", messageOf(error))

    return Response.json({ error: "unavailable" }, { status: 500 })
  }
  if (!booking) {
    return Response.json({ error: "not found" }, { status: 404 })
  }

  const meta = metaOf(booking)

  // Render what was booked: the create action validated the selection at write
  // time, so the stored addonIds are trusted as-is (re-checking today's
  // incompatibility rules here would silently drop paid line items from old
  // bookings). Unknown/archived ids simply don't resolve to catalog rows.
  // Catalog failures degrade to schedule-only rather than failing the recap.
  let selection: BookingRecap["selection"] = null
  if (meta.serviceId) {
    try {
      const catalog = await getServiceWithAddons(meta.serviceId, supabase)
      if (catalog) {
        selection = localizeSelection(
          catalog.service,
          catalog.addons,
          locale,
          meta.addonIds ?? [],
        )
      }
    } catch (catalogError) {
      console.error(
        "[bookings-recap] catalog resolution failed",
        catalogError instanceof Error ? catalogError.message : catalogError,
      )
    }
  }

  const recap: BookingRecap = {
    status: booking.status,
    startTime: booking.start_time,
    endTime: booking.end_time,
    selection,
  }

  return Response.json(recap)
}

export type { BookingRecap }

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : error
