import "server-only"

import {
  listActiveBookingsFrom,
  listBookingsBefore,
  listBookingsForClient,
  listBookingsFrom,
  type BookingRow,
} from "@/db/bookings"
import type { ClientContact } from "@/lib/identity/contact"
import { createAuthedSupabaseServerClient } from "@/platform/supabase/server"

import { groupIntoAgenda, type AgendaWeek } from "@/shared/booking-agenda"
import { resolveAdminBookings } from "./admin-view"
import { getBookingMediaThumbs } from "./booking-media"
import type { BookingThumb } from "@/shared/booking-view"
import { toDisplayBookings } from "./booking-view"
import type { DisplayBooking } from "@/shared/booking-view"

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

/** Resolve rows to everything an admin booking surface renders. */
async function resolveForAdmin(
  rows: BookingRow[],
  context: string,
): Promise<AdminBookingView> {
  const supabase = await createAuthedSupabaseServerClient()
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
    const view = await resolveForAdmin(rows, "admin-queue")
    return { ...view, weeks: groupIntoAgenda(view.bookings, now) }
  } catch (error) {
    console.error("[admin-queue] read failed", messageOf(error))
    return { ...EMPTY, weeks: groupIntoAgenda([], now) }
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
    return await resolveForAdmin([...upcoming, ...past], "admin-appointments")
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
    return await resolveForAdmin(rows, "admin-client")
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

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : error
