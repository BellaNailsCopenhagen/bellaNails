import "server-only"

import {
  getBookingForManage,
  getCurrentBooking,
  getNextBooking,
  listActiveBookingsFrom,
  listBookingsBefore,
  listBookingsForClient,
  listBookingsFrom,
  type BookingRow,
} from "@/db/bookings"
import type { Db } from "@/db/client"
import type { ClientContact } from "@/shared/contact"
import {
  createAuthedSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/platform/supabase/server"

import { groupIntoAgenda, type AgendaWeek } from "@/shared/booking-agenda"
import { resolveAdminBookings } from "./admin-view"
import { getBookingMediaThumbs } from "./booking-media"
import type { BookingThumb } from "@/shared/booking-view"
import { toDisplayBookings } from "./booking-view"
import type { DisplayBooking } from "@/shared/booking-view"
import { requireOwner } from "@/modules/identity/require-owner"

/**
 * The page-facing reads: one call per surface, returning everything that
 * surface renders. Each composes the row read, the display resolve, contacts,
 * no-show counts and photo thumbnails — work the pages used to do inline.
 *
 * Every one degrades rather than throwing: a failed read yields empty data
 * plus `loadError`, so the page can show its error state and still render.
 */

export type AdminBookingView = {
  bookings: DisplayBooking[]
  contacts: Record<string, ClientContact>
  noShowCounts: Record<string, number>
  photosByBooking: Record<string, BookingThumb[]>
  loadError: boolean
}

const EMPTY: AdminBookingView = {
  bookings: [],
  contacts: {},
  noShowCounts: {},
  photosByBooking: {},
  loadError: true,
}

/** Resolve rows to everything an admin booking surface renders. Takes the caller's
    authed client so a surface doesn't build a second one. */
async function resolveForAdmin(
  rows: BookingRow[],
  context: string,
  supabase: Db,
): Promise<AdminBookingView> {
  const [resolved, photosByBooking] = await Promise.all([
    resolveAdminBookings(supabase, rows, context),
    getBookingMediaThumbs(
      supabase,
      rows.map((r) => r.id),
    ),
  ])
  return { ...resolved, photosByBooking, loadError: false }
}

/**
 * The admin queue: the forward agenda across all clients, grouped by week →
 * day. "Upcoming" is not-yet-ENDED, so an in-progress appointment stays in the
 * queue; grouping still keys off start time.
 */
export async function getAdminQueue(
  now: number,
): Promise<AdminBookingView & { weeks: AgendaWeek[] }> {
  try {
    const supabase = await createAuthedSupabaseServerClient()
    const rows = await listActiveBookingsFrom(
      supabase,
      new Date(now).toISOString(),
    )
    const view = await resolveForAdmin(rows, "admin-queue", supabase)
    return { ...view, weeks: groupIntoAgenda(view.bookings, now) }
  } catch (error) {
    console.error("[admin-queue] read failed", messageOf(error))
    return { ...EMPTY, weeks: groupIntoAgenda([], now) }
  }
}

/** The command-centre "now": the booking in progress + the next one, plus the
    contacts / no-show counts / photos those two cards render. Degrades to nulls. */
export type AdminFocus = {
  current: DisplayBooking | null
  next: DisplayBooking | null
  contacts: Record<string, ClientContact>
  noShowCounts: Record<string, number>
  photosByBooking: Record<string, BookingThumb[]>
  loadError: boolean
}

export async function getAdminFocus(now: number): Promise<AdminFocus> {
  try {
    const supabase = await createAuthedSupabaseServerClient()
    const nowIso = new Date(now).toISOString()
    // Two targeted reads — the in-progress booking + the soonest upcoming one —
    // so overlaps (override / accepted requests) can never hide the real "next".
    const [currentRow, nextRow] = await Promise.all([
      getCurrentBooking(supabase, nowIso),
      getNextBooking(supabase, nowIso),
    ])
    const rows = [currentRow, nextRow].filter((r) => r !== null)
    const view = await resolveForAdmin(rows, "admin-focus", supabase)
    return {
      current: view.bookings.find((b) => b.row.id === currentRow?.id) ?? null,
      next: view.bookings.find((b) => b.row.id === nextRow?.id) ?? null,
      contacts: view.contacts,
      noShowCounts: view.noShowCounts,
      photosByBooking: view.photosByBooking,
      loadError: false,
    }
  } catch (error) {
    console.error("[admin-focus] read failed", messageOf(error))
    return {
      current: null,
      next: null,
      contacts: {},
      noShowCounts: {},
      photosByBooking: {},
      loadError: true,
    }
  }
}

/**
 * The full appointments browse: every upcoming booking (any status) plus a
 * capped window of recent past ones.
 */
export async function getAdminAppointments(
  now: number,
  pastLimit: number,
): Promise<AdminBookingView> {
  try {
    const supabase = await createAuthedSupabaseServerClient()
    const nowIso = new Date(now).toISOString()
    const [upcoming, past] = await Promise.all([
      listBookingsFrom(supabase, nowIso),
      listBookingsBefore(supabase, nowIso, pastLimit),
    ])
    return await resolveForAdmin([...upcoming, ...past], "admin-appointments", supabase)
  } catch (error) {
    console.error("[admin-appointments] read failed", messageOf(error))
    return EMPTY
  }
}

/** One client's full booking history, for their admin detail page. */
export async function getClientBookingHistory(
  clientId: string,
): Promise<AdminBookingView> {
  try {
    const supabase = await createAuthedSupabaseServerClient()
    const rows = await listBookingsForClient(supabase, clientId)
    return await resolveForAdmin(rows, "admin-client", supabase)
  } catch (error) {
    console.error("[admin-client] read failed", messageOf(error))
    return EMPTY
  }
}

/**
 * The signed-in client's own appointments. Always filters by the caller's id
 * even though RLS scopes reads — the owner's reads-all policy would otherwise
 * surface the whole studio on their personal page.
 */
export async function getMyBookings(
  clientId: string,
  locale: string,
): Promise<{ bookings: DisplayBooking[]; loadError: boolean }> {
  try {
    const supabase = await createAuthedSupabaseServerClient()
    const rows = await listBookingsForClient(supabase, clientId)
    const bookings = await toDisplayBookings(
      supabase,
      rows,
      locale,
      "my-bookings",
    )
    return { bookings, loadError: false }
  } catch (error) {
    console.error("[my-bookings] read failed", messageOf(error))
    return { bookings: [], loadError: true }
  }
}

/** The manage state a reschedule gate checks, read as the signed-in client by
    row id (RLS proves ownership). Null when there is no such booking. */
export async function getMyBookingForManage(id: string) {
  const db = await createAuthedSupabaseServerClient()
  return getBookingForManage(db, id)
}

/**
 * The same booking read with no ownership constraint, for a caller holding a
 * VERIFIED signed link — the emailed manage page. The token is the
 * authorization, which is why this one takes no owner check; the name says so
 * rather than leaving the next caller to guess.
 *
 * Only call this after `verifyBookingToken` has returned an id.
 */
export async function getBookingForSignedToken(id: string) {
  return getBookingForManage(createSupabaseServiceRoleClient(), id)
}

/** The same, read as the studio. Owner-gated: no token is involved, so this
    one carries its own check rather than trusting the surface. */
export async function getBookingForManageAsOwner(id: string) {
  const db = await requireOwner()
  if (!db) return null
  return getBookingForManage(db, id)
}

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : error
