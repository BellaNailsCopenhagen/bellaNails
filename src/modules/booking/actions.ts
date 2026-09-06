"use server"

import { revalidatePath } from "next/cache"

import type { Slot } from "@/shared/booking-slots"

import {
  cancelBookingById,
  getBookingForManage,
  rescheduleBookingById,
  setBookingNoShowAt,
  type BookingManageState,
} from "@/db/bookings"
import type { Db } from "@/db/client"
import {
  getOverrideSlotsForDuration,
  getSlotsForDuration,
} from "@/modules/booking/availability"
import { manageUrlFor, verifyBookingToken } from "@/modules/booking/manage-token"
import { fetchClientContacts } from "@/modules/clients"
import { markInsightsMonthStale } from "@/db/insights-months"
import { requireOwner } from "@/modules/identity/require-owner"
import { monthKeyOf } from "@/modules/studio/insights"
import { getCurrentUser } from "@/modules/identity/server"
import {
  sendBookingCancellationEmail,
  sendBookingRescheduleEmail,
  type BookingEmailDetail,
} from "@/modules/notifications/booking-email"
import {
  recordCommunication,
  statusFromEmailResult,
} from "@/modules/notifications/communications"
import {
  createAuthedSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/platform/supabase/server"
import {
  canManageBooking,
  canMarkNoShow,
  localizedBookingNames,
  metaOf,
  bookedDurationMins,
} from "@/shared/booking-policy"
import {
  BOOKING_STATUS,
  isActiveBookingStatus,
} from "@/shared/booking-status"
import { routes, revalidatePatterns } from "@/shared/routes"

/**
 * Every booking mutation a UI can trigger — now fully in-house (no Cal). Each
 * one re-establishes who the caller is before it does anything (the UI is never
 * the authorization boundary): the client actions prove ownership with the
 * RLS-scoped authed *read*, then write with service-role (bookings has no client
 * UPDATE policy — an authed write would silently affect zero rows). Owner
 * actions re-check the role via requireOwner.
 */

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Admin surfaces that render a booking's manage buttons — all revalidated
    together after an owner mutation so none is left showing stale state. */
function revalidateAdminBookingViews(): void {
  revalidatePath(routes.admin.home)
  revalidatePath(routes.admin.appointments)
  revalidatePath(revalidatePatterns.adminClient, "page")
}

/**
 * Send the client the cancel/reschedule email for a managed booking — always
 * best-effort. Resolves the recipient from the client row and localizes the
 * service/add-on names off the as-booked snapshot; no email on file → skipped
 * (the action still succeeds). The reschedule window is threaded in by the
 * caller (the pre-write `booking` still holds the previous time).
 */
async function emailManagedBooking(
  id: string,
  booking: BookingManageState,
  kind: "cancelled" | "moved",
  window: { startIso: string; endIso: string; previousStartIso?: string },
  actor: "client" | "studio",
): Promise<void> {
  try {
    const contact = (await fetchClientContacts([booking.client_id]))[
      booking.client_id
    ]
    if (!contact?.email) return

    const meta = metaOf(booking)
    // Emails follow the client's saved language preference.
    const locale = contact.communicationLocale
    const { serviceName, addonNames } = localizedBookingNames(meta, locale)
    const detail: BookingEmailDetail = {
      to: contact.email,
      firstName: contact.firstName,
      serviceName,
      addonNames,
      startIso: window.startIso,
      endIso: window.endIso,
      previousStartIso: window.previousStartIso,
      // Only a move keeps the booking live enough to manage again.
      manageUrl: kind === "moved" ? manageUrlFor(locale, id) : undefined,
      bookingId: id,
      actor,
      locale,
    }
    const res =
      kind === "cancelled"
        ? await sendBookingCancellationEmail(detail)
        : await sendBookingRescheduleEmail(detail)
    if (booking.client_id) {
      await recordCommunication({
        clientId: booking.client_id,
        bookingId: id,
        kind: kind === "cancelled" ? "cancellation" : "reschedule",
        trigger: "auto",
        recipient: contact.email,
        status: statusFromEmailResult(res),
        error: res.error,
      })
    }
  } catch (error) {
    console.error(
      "[booking] manage email failed —",
      error instanceof Error ? error.message : error,
    )
  }
}

// The reschedule email's before/after: the booking's previous start and the
// new window (service/add-ons/duration are unchanged by a move).
function rescheduleWindow(
  booking: BookingManageState,
  newStart: string,
  newEnd: string,
): { startIso: string; endIso: string; previousStartIso: string } {
  return { previousStartIso: booking.start_time, startIso: newStart, endIso: newEnd }
}

type CancelResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "not_found" | "within_policy" | "failed" }

/**
 * Cancel a booking in-app: ownership is proven by the RLS read + write (the
 * authed client only touches the caller's rows), and the 24 h policy is
 * re-checked server-side (the UI disable is not a boundary).
 */
export async function cancelBooking(id: string): Promise<CancelResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "unauthorized" }
  if (!UUID.test(id)) return { ok: false, error: "not_found" }

  const supabase = await createAuthedSupabaseServerClient()
  const booking = await getBookingForManage(supabase, id)
  if (!booking) return { ok: false, error: "not_found" }

  if (booking.status === BOOKING_STATUS.cancelled) {
    // Already cancelled out-of-band — refresh the stale card that offered
    // the button.
    revalidatePath(revalidatePatterns.publicAppointments, "page")
    return { ok: true }
  }
  if (!canManageBooking(booking, Date.now())) {
    return { ok: false, error: "within_policy" }
  }

  // Ownership proven by the authed read above; the write needs service-role.
  const result = await cancelBookingById(createSupabaseServiceRoleClient(), id)
  if (!result.ok) return { ok: false, error: "failed" }

  await emailManagedBooking(
    id,
    booking,
    "cancelled",
    { startIso: booking.start_time, endIso: booking.end_time },
    "client",
  )
  revalidatePath(revalidatePatterns.publicAppointments, "page")
  return { ok: true }
}

type OwnerCancelResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "not_found" | "failed" }

/**
 * Cancel any booking on the studio's behalf. Unlike the client action there is
 * **no 24 h policy** — the studio can cancel at any time.
 */
export async function cancelBookingAsOwner(
  id: string,
): Promise<OwnerCancelResult> {
  const service = await requireOwner()
  if (!service) return { ok: false, error: "unauthorized" }
  if (!UUID.test(id)) return { ok: false, error: "not_found" }

  const booking = await getBookingForManage(service, id)
  if (!booking) return { ok: false, error: "not_found" }

  if (booking.status === BOOKING_STATUS.cancelled) {
    revalidateAdminBookingViews()
    return { ok: true }
  }

  const result = await cancelBookingById(service, id)
  if (!result.ok) return { ok: false, error: "failed" }

  await emailManagedBooking(
    id,
    booking,
    "cancelled",
    { startIso: booking.start_time, endIso: booking.end_time },
    "studio",
  )
  revalidateAdminBookingViews()
  return { ok: true }
}

type RescheduleResult =
  | { ok: true }
  | {
      ok: false
      error:
        | "unauthorized"
        | "not_found"
        | "within_policy"
        | "unavailable"
        | "failed"
    }

/**
 * OVERRIDE free times for moving an EXISTING booking — hours/days-off/lead
 * ignored, taken slots still excluded, sized by the booking's own as-booked
 * duration. Takes a booking id rather than a duration on purpose: the length of
 * an appointment is never the browser's to choose. Returns [] when not the owner.
 */
export async function getOwnerOverrideSlotsForBooking(
  bookingId: string,
): Promise<Slot[]> {
  const db = await requireOwner()
  if (!db) return []
  const booking = await getBookingForManage(db, bookingId)
  if (!booking) return []
  const mins = bookedDurationMins(booking)
  if (!(mins > 0)) return []
  return getOverrideSlotsForDuration(mins, db)
}

/**
 * The new slot's end for a booking, re-validated against live availability
 * (studio hours, lead time, other bookings). Null when the service is unknown
 * or the chosen start isn't actually offered — never trust the client's time.
 */
async function resolveNewSlotEnd(
  booking: BookingManageState,
  newStart: string,
  ignoreLeadTime: boolean,
): Promise<string | null> {
  const startMs = new Date(newStart).getTime()
  if (!Number.isFinite(startMs)) return null

  // Validate AND size the move from the as-booked footprint, so a since-changed
  // catalog duration can't stretch an existing booking — and a booking with no
  // catalog service (a one-time offer) can still be moved.
  const bookedMins = bookedDurationMins(booking)
  if (!(bookedMins > 0)) return null

  const slots = await getSlotsForDuration(bookedMins, undefined, {
    ignoreLeadTime,
  })
  if (!slots.some((s) => new Date(s.start).getTime() === startMs)) return null
  return new Date(startMs + bookedMins * 60_000).toISOString()
}

/**
 * The new end for an OWNER OVERRIDE move — no slot check (hours/day/lead ignored),
 * keeping the as-booked length (snapshot mins, else the booking's current span).
 * The overlap exclusion constraint still blocks a clash on write.
 */
function overrideRescheduleEnd(
  booking: BookingManageState,
  newStart: string,
): string | null {
  const startMs = new Date(newStart).getTime()
  if (!Number.isFinite(startMs)) return null
  const bookedMins = bookedDurationMins(booking)
  if (!(bookedMins > 0)) return null
  return new Date(startMs + bookedMins * 60_000).toISOString()
}

// The applied move carries the new `end` so the reschedule email + .ics get the
// correct window without re-deriving it.
type ApplyResult =
  | { ok: true; end: string }
  | { ok: false; error: "unavailable" | "failed" }

// `writeDb` is service-role in both paths (ownership is already proven by the
// caller's read); `ignoreLeadTime` lets the owner path reach near-term slots,
// `ignoreLimits` (owner-only) skips the availability check entirely.
async function applyReschedule(
  writeDb: Db,
  id: string,
  booking: BookingManageState,
  newStart: string,
  opts: { ignoreLeadTime: boolean; ignoreLimits?: boolean },
): Promise<ApplyResult> {
  const end = opts.ignoreLimits
    ? overrideRescheduleEnd(booking, newStart)
    : await resolveNewSlotEnd(booking, newStart, opts.ignoreLeadTime)
  if (!end) return { ok: false, error: "unavailable" }

  const result = await rescheduleBookingById(writeDb, id, newStart, end)
  if (!result.ok) {
    return { ok: false, error: result.reason === "overlap" ? "unavailable" : "failed" }
  }
  return { ok: true, end }
}

/**
 * Move a booking to a new time in-app. Ownership via the RLS authed client, the
 * 24 h policy re-checked, and the chosen slot re-validated (with the booking's
 * own service + add-ons) before the write.
 */
export async function rescheduleBooking(
  id: string,
  newStart: string,
): Promise<RescheduleResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, error: "unauthorized" }
  if (!UUID.test(id)) return { ok: false, error: "not_found" }

  const supabase = await createAuthedSupabaseServerClient()
  const booking = await getBookingForManage(supabase, id)
  if (!booking) return { ok: false, error: "not_found" }
  if (!canManageBooking(booking, Date.now())) {
    return { ok: false, error: "within_policy" }
  }

  // Ownership proven by the authed read; write with service-role, public rules.
  const applied = await applyReschedule(
    createSupabaseServiceRoleClient(),
    id,
    booking,
    newStart,
    { ignoreLeadTime: false },
  )
  if (!applied.ok) return applied

  await emailManagedBooking(
    id,
    booking,
    "moved",
    rescheduleWindow(booking, newStart, applied.end),
    "client",
  )
  revalidatePath(revalidatePatterns.publicAppointments, "page")
  return { ok: true }
}

/**
 * Reschedule any active booking on the studio's behalf — no 24 h policy. The
 * slot is still re-validated so the studio can't double-book itself.
 */
export async function rescheduleBookingAsOwner(
  id: string,
  newStart: string,
  opts?: { ignoreLimits?: boolean },
): Promise<RescheduleResult> {
  const service = await requireOwner()
  if (!service) return { ok: false, error: "unauthorized" }
  if (!UUID.test(id)) return { ok: false, error: "not_found" }

  const booking = await getBookingForManage(service, id)
  if (!booking || !isActiveBookingStatus(booking.status)) {
    return { ok: false, error: "not_found" }
  }

  // The studio isn't bound by the public 24 h lead time; "ignore limits" also
  // frees it from hours/day availability (overlap constraint still applies).
  const applied = await applyReschedule(service, id, booking, newStart, {
    ignoreLeadTime: true,
    ignoreLimits: opts?.ignoreLimits,
  })
  if (!applied.ok) return applied

  await emailManagedBooking(
    id,
    booking,
    "moved",
    rescheduleWindow(booking, newStart, applied.end),
    "studio",
  )
  revalidateAdminBookingViews()
  return { ok: true }
}

// --- Guest self-service (email link) --------------------------------------
// The signed token IS the authorization (it proves the caller holds the booking
// email); the write is service-role, still gated by the same 24 h policy. Public
// booking rules apply — a guest is no more privileged than the public flow.

export async function cancelBookingByToken(token: string): Promise<CancelResult> {
  const id = verifyBookingToken(token)
  if (!id) return { ok: false, error: "not_found" }

  const service = createSupabaseServiceRoleClient()
  const booking = await getBookingForManage(service, id)
  if (!booking) return { ok: false, error: "not_found" }
  if (booking.status === BOOKING_STATUS.cancelled) {
    revalidatePath(revalidatePatterns.publicManage, "page")
    return { ok: true }
  }
  if (!canManageBooking(booking, Date.now())) {
    return { ok: false, error: "within_policy" }
  }

  const result = await cancelBookingById(service, id)
  if (!result.ok) return { ok: false, error: "failed" }

  await emailManagedBooking(
    id,
    booking,
    "cancelled",
    { startIso: booking.start_time, endIso: booking.end_time },
    "client",
  )
  revalidatePath(revalidatePatterns.publicManage, "page")
  return { ok: true }
}

export async function rescheduleBookingByToken(
  token: string,
  newStart: string,
): Promise<RescheduleResult> {
  const id = verifyBookingToken(token)
  if (!id) return { ok: false, error: "not_found" }

  const service = createSupabaseServiceRoleClient()
  const booking = await getBookingForManage(service, id)
  if (!booking) return { ok: false, error: "not_found" }
  if (!canManageBooking(booking, Date.now())) {
    return { ok: false, error: "within_policy" }
  }

  const applied = await applyReschedule(service, id, booking, newStart, {
    ignoreLeadTime: false,
  })
  if (!applied.ok) return applied

  await emailManagedBooking(
    id,
    booking,
    "moved",
    rescheduleWindow(booking, newStart, applied.end),
    "client",
  )
  revalidatePath(revalidatePatterns.publicManage, "page")
  return { ok: true }
}

type NoShowResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "not_found" | "ineligible" | "failed" }

/**
 * Toggle the studio-side no-show marker. `no_show_at` is OUR column, separate
 * from the booking `status`, so clients never see it. Setting a mark re-checks
 * eligibility (an hour past start); clearing one is always allowed.
 */
export async function setBookingNoShow(
  id: string,
  noShow: boolean,
): Promise<NoShowResult> {
  const service = await requireOwner()
  if (!service) return { ok: false, error: "unauthorized" }
  if (!UUID.test(id)) return { ok: false, error: "not_found" }

  const booking = await getBookingForManage(service, id)
  if (!booking) return { ok: false, error: "not_found" }
  if (noShow && !canMarkNoShow(booking, Date.now())) {
    return { ok: false, error: "ineligible" }
  }

  const result = await setBookingNoShowAt(
    service,
    id,
    noShow ? new Date().toISOString() : null,
  )
  if (!result.ok) return { ok: false, error: "failed" }

  // A no-show earns nothing (shared/insights.ts), so marking one changes that
  // month's income — and a closed month is served from a kept row that would
  // otherwise keep reporting the price nobody paid. Marked, not dropped: the
  // hours that month was open are unchanged and must not be worked out again.
  await markInsightsMonthStale(service, monthKeyOf(booking.start_time))

  revalidateAdminBookingViews()
  revalidatePath(routes.admin.insights)
  return { ok: true }
}
