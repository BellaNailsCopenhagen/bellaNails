import type { SupabaseClient } from "@supabase/supabase-js"

import { isActiveBookingStatus } from "@/lib/booking-status"
import { pickLocalized } from "@/lib/i18n/localized"
import type { Database } from "@/lib/supabase/types"

/**
 * Shared booking→display resolution for every surface that renders a
 * `bookings` row (the /bookings list, the home next-appointment card).
 * Client-safe: works with both the RLS server client and the browser client.
 */

/** The columns booking displays render — select exactly these. `clerk_user_id`
    is the pseudonymous client id (not PII); the admin queue resolves it to
    name/phone/email via Clerk, the client list simply ignores it. */
export const BOOKING_DISPLAY_COLUMNS =
  "cal_booking_id, cal_uid, clerk_user_id, start_time, end_time, status, total_price_cents, selected_addons, client_notes, reschedule_url, cancel_url, no_show_at"

export type BookingRow = Pick<
  Database["public"]["Tables"]["bookings"]["Row"],
  | "cal_booking_id"
  | "cal_uid"
  | "clerk_user_id"
  | "start_time"
  | "end_time"
  | "status"
  | "total_price_cents"
  | "selected_addons"
  | "client_notes"
  | "reschedule_url"
  | "cancel_url"
  | "no_show_at"
>

/** IDs-only payload the webhook stored from the embed handoff. */
export type BookingMeta = {
  serviceId?: string | null
  addonIds?: string[] | null
  totalDurationMins?: number | null
}

/** Display-ready booking: row + localized names resolved from the catalog. */
export type DisplayBooking = {
  row: BookingRow
  serviceName: string | null
  addonNames: string[]
  durationMins: number | null
  clientNotes: string | null
  /** Catalog entry still exists (RLS hides archived services) — gates the
      "book again" deep link. */
  rebookable: boolean
}

/** 24-hour cancellation policy: inside this window the Cal links are
    withheld and the client is pointed at the studio instead. */
export const POLICY_WINDOW_MS = 24 * 60 * 60 * 1000

/** THE eligibility rule for client-side manage actions (reschedule/cancel):
    an active booking starting at least the policy window from now. Every
    surface — card buttons, cancel action, reschedule page — asks this. */
export function canManageBooking(
  row: Pick<BookingRow, "status" | "start_time">,
  now: number,
): boolean {
  return (
    isActiveBookingStatus(row.status) &&
    new Date(row.start_time).getTime() - now >= POLICY_WINDOW_MS
  )
}

/** No-show is markable only once an appointment is well underway — an hour past
    its start (covers finished appointments and long in-progress ones). This is
    studio-side only; it never applies to cancelled bookings. Both the card
    (which reveals the action) and the owner action ask this. */
export const NO_SHOW_GRACE_MS = 60 * 60 * 1000

export function canMarkNoShow(
  row: Pick<BookingRow, "status" | "start_time">,
  now: number,
): boolean {
  return (
    isActiveBookingStatus(row.status) &&
    now >= new Date(row.start_time).getTime() + NO_SHOW_GRACE_MS
  )
}

export const metaOf = (row: Pick<BookingRow, "selected_addons">) =>
  (row.selected_addons ?? {}) as BookingMeta

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type CatalogEntry = {
  id: string
  name_en: string
  name_dk: string | null
  addons: { id: string; name_en: string; name_dk: string | null }[]
}

export type BookingCatalog = Map<string, CatalogEntry>

/** One query for every service+addon name a set of bookings needs. A
    missing entry means archived/unknown (RLS filters archived rows) —
    callers fall back to the generic session label. */
export async function fetchBookingCatalog(
  supabase: SupabaseClient<Database>,
  serviceIds: (string | null | undefined)[],
): Promise<BookingCatalog> {
  const ids = [
    ...new Set(
      serviceIds.filter((id): id is string =>
        Boolean(id && UUID_PATTERN.test(id)),
      ),
    ),
  ]
  if (ids.length === 0) return new Map()

  const { data, error } = await supabase
    .from("services")
    .select("id, name_en, name_dk, addons(id, name_en, name_dk)")
    .in("id", ids)
  if (error) throw new Error(error.message)

  return new Map((data ?? []).map((entry) => [entry.id, entry]))
}

/**
 * Resolve a set of booking rows to display shape in one pass: fetch the name
 * catalog once, then map each row. A catalog failure degrades every row to the
 * generic session label rather than throwing. Shared by the client list
 * (`my-bookings`) and the admin queue so the catalog+map boilerplate lives in
 * one place. Client-safe (works with either Supabase client).
 */
export async function toDisplayBookings(
  supabase: SupabaseClient<Database>,
  rows: BookingRow[],
  locale: string,
  /** Log context so a catalog failure names the calling surface. */
  context = "bookings",
): Promise<DisplayBooking[]> {
  let catalog: BookingCatalog = new Map()
  try {
    catalog = await fetchBookingCatalog(
      supabase,
      rows.map((row) => metaOf(row).serviceId),
    )
  } catch (error) {
    console.error(
      `[${context}] catalog resolution failed`,
      error instanceof Error ? error.message : error,
    )
  }
  return rows.map((row) => toDisplayBooking(row, catalog, locale))
}

export function toDisplayBooking(
  row: BookingRow,
  catalog: BookingCatalog,
  locale: string,
): DisplayBooking {
  const meta = metaOf(row)
  const entry = meta.serviceId ? catalog.get(meta.serviceId) : undefined
  const addonById = new Map((entry?.addons ?? []).map((a) => [a.id, a]))

  return {
    row,
    serviceName: entry
      ? (pickLocalized(locale, entry.name_en, entry.name_dk) ?? entry.name_en)
      : null,
    addonNames: (meta.addonIds ?? []).flatMap((id) => {
      const addon = addonById.get(id)
      return addon
        ? [pickLocalized(locale, addon.name_en, addon.name_dk) ?? addon.name_en]
        : []
    }),
    durationMins: meta.totalDurationMins ?? null,
    clientNotes: row.client_notes,
    rebookable: Boolean(entry),
  }
}
