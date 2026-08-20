import type { SupabaseClient } from "@supabase/supabase-js"

import { BOOKING_STATUS, isActiveBookingStatus } from "@/shared/booking-status"
import { pickLocalized } from "@/lib/i18n/localized"
import { flattenServiceAddons } from "@/lib/services/service-addons"
import type { Database } from "@/platform/supabase/types"

/**
 * Shared booking→display resolution for every surface that renders a
 * `bookings` row (the /bookings list, the home next-appointment card).
 * Client-safe: works with both the RLS server client and the browser client.
 */

/** The columns booking displays render — select exactly these. `client_id`
    is the client's identity key (not PII); the admin queue resolves it to
    name/phone/email via the clients table, the client list simply ignores it. */
export const BOOKING_DISPLAY_COLUMNS =
  "id, cal_booking_id, cal_uid, client_id, start_time, end_time, status, total_price_cents, selected_addons, client_notes, reschedule_url, cancel_url, no_show_at"

export type BookingRow = Pick<
  Database["public"]["Tables"]["bookings"]["Row"],
  | "id"
  | "cal_booking_id"
  | "cal_uid"
  | "client_id"
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

/** The metadata blob on a booking: the embed's id payload plus a snapshot of
    the product AS BOOKED, so editing the catalog never rewrites old bookings.
    Old bookings have no snapshot — display falls back to the live catalog. */
export type BookingMeta = {
  serviceId?: string | null
  addonIds?: string[] | null
  totalDurationMins?: number | null
  // Historic product snapshot (captured at persist time).
  serviceNameEn?: string | null
  serviceNameDk?: string | null
  serviceDescriptionEn?: string | null
  serviceDescriptionDk?: string | null
  addonSnapshots?: { id: string; nameEn: string; nameDk: string | null }[] | null
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

/** The one exclusive, lifecycle-aware state a booking is in — the vocabulary the
    admin status filters classify by. No-show and cancelled win over the
    active statuses; an active booking is `open` until it has happened, then
    `completed` (so an upcoming confirmed booking is never labelled "completed").
    Rescheduled folds into open/completed by date — the "moved" fact stays on
    the card's badge. */
export type BookingState = "open" | "completed" | "cancelled" | "no-show"

export function bookingState(
  row: Pick<BookingRow, "status" | "no_show_at" | "end_time">,
  now: number,
): BookingState {
  if (row.no_show_at) return "no-show"
  if (row.status === BOOKING_STATUS.cancelled) return "cancelled"
  return new Date(row.end_time).getTime() >= now ? "open" : "completed"
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
    .select(
      "id, name_en, name_dk, service_addons(addons(id, name_en, name_dk))",
    )
    .in("id", ids)
  if (error) throw new Error(error.message)

  // Add-ons come through the service_addons join now — flatten to the catalog
  // entry shape.
  type Row = {
    id: string
    name_en: string
    name_dk: string | null
    service_addons: { addons: CatalogEntry["addons"][number] | null }[]
  }
  return new Map(
    ((data ?? []) as unknown as Row[]).map((entry) => [
      entry.id,
      {
        id: entry.id,
        name_en: entry.name_en,
        name_dk: entry.name_dk,
        addons: flattenServiceAddons(entry.service_addons),
      },
    ]),
  )
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

  // Prefer the historic snapshot; fall back to the live catalog for old
  // bookings (persisted before snapshots), which may show current names.
  const snapshotName = meta.serviceNameEn
    ? pickLocalized(locale, meta.serviceNameEn, meta.serviceNameDk ?? null)
    : null
  const serviceName =
    snapshotName ??
    (entry
      ? (pickLocalized(locale, entry.name_en, entry.name_dk) ?? entry.name_en)
      : null)

  const addonNames = meta.addonSnapshots?.length
    ? meta.addonSnapshots.map(
        (a) => pickLocalized(locale, a.nameEn, a.nameDk ?? null) ?? a.nameEn,
      )
    : (meta.addonIds ?? []).flatMap((id) => {
        const addon = addonById.get(id)
        return addon
          ? [pickLocalized(locale, addon.name_en, addon.name_dk) ?? addon.name_en]
          : []
      })

  return {
    row,
    serviceName,
    addonNames,
    durationMins: meta.totalDurationMins ?? null,
    clientNotes: row.client_notes,
    rebookable: Boolean(entry),
  }
}
