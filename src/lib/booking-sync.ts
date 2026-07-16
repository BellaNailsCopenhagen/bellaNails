import "server-only"

import { ensureClerkUser } from "@/lib/clerk/ensure-user"
import { BOOKING_STATUS, type BookingStatus } from "@/lib/booking-status"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import { CALCOM_API_BASE, CALCOM_BOOKING_ORIGIN } from "@/config/calcom"

/**
 * The create/reschedule persist path for `bookings`, fed by two callers with
 * the same snapshot shape: the Cal webhook (push — delivers ~1–4 min behind)
 * and syncBookingFromCal (pull — fetches from Cal API right after embed
 * success so the client never waits on the queue). Writes are idempotent
 * and never reactivate a cancelled row, so arrival order doesn't matter.
 * Cancellation mirrors (webhook markCancelled, the cancel action) update
 * status only and live with their callers.
 */

/** Cal uids are url-safe tokens (observed ~22 chars). */
export const CAL_UID_PATTERN = /^[A-Za-z0-9_-]{12,64}$/

/** Cal metadata values arrive as strings — parse defensively. */
function metaInt(value: unknown): number | null {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : NaN
  return Number.isFinite(n) ? n : null
}

function metaString(value: unknown): string | null {
  return typeof value === "string" && value.length ? value : null
}

export type CalBookingSnapshot = {
  bookingId: number
  uid: string
  startTime: string
  endTime: string
  attendeeEmail: string
  attendeeName?: string
  attendeePhone?: string
  /** uid of the booking this one replaced. */
  rescheduleUid?: string | null
  metadata: Record<string, unknown>
  status: BookingStatus
}

export type PersistResult = { ok: true } | { ok: false; message: string }

export async function persistCalBooking(
  snapshot: CalBookingSnapshot,
): Promise<PersistResult> {
  const supabase = createSupabaseServiceRoleClient()

  const { data: existing } = await supabase
    .from("bookings")
    .select("cal_booking_id, status")
    .eq("cal_booking_id", snapshot.bookingId)
    .maybeSingle()

  // Cancelled is terminal (Cal never un-cancels a uid; reschedules mint a
  // new one), so a late active snapshot — e.g. the queued BOOKING_CREATED
  // arriving after an in-app cancel or reschedule already closed the row —
  // must not resurrect it.
  const staleSnapshot =
    existing?.status === BOOKING_STATUS.cancelled &&
    snapshot.status !== BOOKING_STATUS.cancelled
  // Same-status re-delivery: skip the Clerk round-trips and the upsert, but
  // still run the replaced-row closure below so a redelivery can heal it.
  const duplicate = existing?.status === snapshot.status

  if (!staleSnapshot && !duplicate) {
    let clerkUserId: string
    try {
      clerkUserId = await ensureClerkUser({
        email: snapshot.attendeeEmail,
        name: snapshot.attendeeName,
        phone: snapshot.attendeePhone,
      })
    } catch (error) {
      return {
        ok: false,
        message: `ensureClerkUser failed: ${error instanceof Error ? error.message : String(error)}`,
      }
    }

    const meta = snapshot.metadata
    const addonIds =
      metaString(meta.addonIds)?.split(",").filter(Boolean) ?? []

    // Cal blocking fewer minutes than the treatment needs means the event
    // type lacks that slot length — the booking is real, log loudly.
    const bookedMins = Math.round(
      (new Date(snapshot.endTime).getTime() -
        new Date(snapshot.startTime).getTime()) /
        60_000,
    )
    const totalDurationMins = metaInt(meta.totalDurationMins)
    if (totalDurationMins && bookedMins < totalDurationMins) {
      console.error("[booking-sync] slot shorter than treatment", {
        bookingId: snapshot.bookingId,
        bookedMins,
        totalDurationMins,
        serviceId: metaString(meta.serviceId),
      })
    }

    const { error } = await supabase.from("bookings").upsert(
      {
        cal_booking_id: snapshot.bookingId,
        cal_uid: snapshot.uid,
        // Keep the old→new chain even when the snapshot is cancelled.
        rescheduled_from_uid: snapshot.rescheduleUid ?? null,
        clerk_user_id: clerkUserId,
        status: snapshot.status,
        start_time: snapshot.startTime,
        end_time: snapshot.endTime,
        // Canonical Cal cloud URL forms — the payloads carry no ready links.
        reschedule_url: `${CALCOM_BOOKING_ORIGIN}/reschedule/${snapshot.uid}`,
        cancel_url: `${CALCOM_BOOKING_ORIGIN}/booking/${snapshot.uid}?cancel=true`,
        total_price_cents: metaInt(meta.totalPriceCents) ?? 0,
        client_notes: metaString(meta.clientNotes),
        selected_addons: {
          serviceId: metaString(meta.serviceId),
          addonIds,
          totalDurationMins: metaInt(meta.totalDurationMins),
          locale: metaString(meta.locale),
        },
      },
      { onConflict: "cal_booking_id" },
    )
    if (error) {
      return { ok: false, message: `bookings upsert failed: ${error.message}` }
    }
  }

  // A reschedule replaces the old booking and Cal fires no BOOKING_CANCELLED
  // for it — close it here, on every delivery (duplicates included), so a
  // failed close gets healed by the next one.
  if (
    snapshot.status === BOOKING_STATUS.rescheduled &&
    snapshot.rescheduleUid
  ) {
    const { error: oldError } = await supabase
      .from("bookings")
      .update({ status: BOOKING_STATUS.cancelled })
      .eq("cal_uid", snapshot.rescheduleUid)
      .neq("cal_booking_id", snapshot.bookingId)
    if (oldError) {
      console.error(
        "[booking-sync] failed to close replaced booking",
        oldError.message,
      )
    }
  }

  return { ok: true }
}

/** Cal API v2 GET /bookings/{uid} — only the fields we read. */
type CalApiBooking = {
  id?: number
  uid?: string
  start?: string
  end?: string
  status?: string
  rescheduledFromUid?: string
  attendees?: { name?: string; email?: string; phoneNumber?: string }[]
  bookingFieldsResponses?: { attendeePhoneNumber?: unknown }
  metadata?: Record<string, unknown>
}

/** Pull the authoritative booking from Cal API v2 and persist it. */
export async function syncBookingFromCal(
  uid: string,
): Promise<{ ok: boolean }> {
  const apiKey = process.env.CALCOM_API_KEY
  if (!apiKey) {
    console.error("[booking-sync] CALCOM_API_KEY not configured")
    return { ok: false }
  }

  let res: Response
  try {
    res = await fetch(`${CALCOM_API_BASE}/bookings/${uid}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "cal-api-version": "2024-08-13",
      },
    })
  } catch (error) {
    console.error(
      "[booking-sync] Cal API unreachable",
      error instanceof Error ? error.message : error,
    )
    return { ok: false }
  }
  if (!res.ok) {
    console.error("[booking-sync] Cal API rejected", uid, res.status)
    return { ok: false }
  }

  const body = (await res.json().catch(() => null)) as {
    data?: CalApiBooking
  } | null
  const data = body?.data
  const attendee = data?.attendees?.[0]
  if (!data?.id || !data.uid || !data.start || !data.end || !attendee?.email) {
    console.error("[booking-sync] unexpected Cal API shape", uid)
    return { ok: false }
  }

  // Only accepted/cancelled map to our vocabulary. pending/rejected (opt-in
  // confirmation — not enabled) must NOT persist as active: bail and let the
  // webhook decide, since BOOKING_CREATED only fires for accepted bookings.
  let status: BookingStatus
  if (data.status === "cancelled") {
    status = BOOKING_STATUS.cancelled
  } else if (data.status === "accepted") {
    status = data.rescheduledFromUid
      ? BOOKING_STATUS.rescheduled
      : BOOKING_STATUS.confirmed
  } else {
    console.error("[booking-sync] unhandled Cal status", uid, data.status)
    return { ok: false }
  }

  const result = await persistCalBooking({
    bookingId: data.id,
    uid: data.uid,
    startTime: data.start,
    endTime: data.end,
    attendeeEmail: attendee.email,
    attendeeName: attendee.name,
    // Same precedence as the webhook: the form answer wins over Cal's
    // attendee record.
    attendeePhone:
      metaString(data.bookingFieldsResponses?.attendeePhoneNumber) ??
      attendee.phoneNumber,
    rescheduleUid: data.rescheduledFromUid ?? null,
    metadata: data.metadata ?? {},
    status,
  })
  if (!result.ok) {
    console.error("[booking-sync] persist failed", uid, result.message)
    return { ok: false }
  }
  return { ok: true }
}
