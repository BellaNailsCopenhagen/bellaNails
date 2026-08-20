import {
  metaOf,
} from "@/shared/booking-policy"
import { CAL_UID_PATTERN } from "@/modules/booking"
import { getServiceWithAddons } from "@/modules/catalog"
import { localizeSelection } from "@/shared/localize-selection"
import { createSupabaseServiceRoleClient } from "@/platform/supabase/server"
import { bookingExists, getBookingRecap } from "@/db/bookings"
import type { BookingLineItem } from "@/shared/booking-totals"

/**
 * Booking recap by Cal uid — read path for /confirmation, where the booker is
 * usually signed out and RLS would hide the row. The uid is an unguessable
 * capability token (the same one Cal's own public booking page uses), so
 * possession of the link authorizes this read. The response is sanitized:
 * schedule + localized catalog line items only — no client_id, no
 * reschedule/cancel URLs, no PII (we store none).
 *
 * `?probe=1` answers "does the row exist yet?" with a single cheap query and
 * no catalog work — the confirm step's post-booking wait polls this form.
 */

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
  { params }: { params: Promise<{ uid: string }> },
) {
  const { uid } = await params
  if (!CAL_UID_PATTERN.test(uid)) {
    return Response.json({ error: "not found" }, { status: 404 })
  }

  const search = new URL(request.url).searchParams
  const supabase = createSupabaseServiceRoleClient()

  if (search.get("probe") === "1") {
    try {
      const exists = await bookingExists(supabase, uid)
      return exists
        ? Response.json({ ok: true })
        : Response.json({ error: "not found" }, { status: 404 })
    } catch (error) {
      console.error("[bookings-recap] probe failed", messageOf(error))
      return Response.json({ error: "unavailable" }, { status: 500 })
    }
  }

  const locale = search.get("locale") ?? "da"
  let booking
  try {
    booking = await getBookingRecap(supabase, uid)
  } catch (error) {
    console.error("[bookings-recap] read failed", messageOf(error))
    return Response.json({ error: "unavailable" }, { status: 500 })
  }
  // 404 while the webhook hasn't landed yet — callers poll briefly.
  if (!booking) {
    return Response.json({ error: "not found" }, { status: 404 })
  }

  const meta = metaOf(booking)

  // Render what was booked: the webhook validated the selection at write
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
