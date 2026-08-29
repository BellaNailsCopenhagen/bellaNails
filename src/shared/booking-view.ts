import type { BookingRow } from "@/db/bookings"

import { metaOf } from "@/shared/booking-policy"
import { pickLocalized } from "@/shared/localized"
import type { ReleasePurposeState } from "@/shared/media-release"

/**
 * The booking view model and its pure mapper. Lives in `shared/` because
 * client components render it — anything a client component needs must not sit
 * behind a module barrel, which is transitively server-only.
 *
 * The async catalog fetch that feeds this lives in `modules/booking`.
 */

/** A service + its add-ons, by name — what the mapper resolves against. */
export type CatalogEntry = {
  id: string
  name_en: string
  name_dk: string | null
  addons: { id: string; name_en: string; name_dk: string | null }[]
}

export type BookingCatalog = Map<string, CatalogEntry>

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
  /** Media-release state per purpose (admin view only) — attached by
      resolveAdminBookings; undefined on client-facing surfaces. */
  releases?: ReleasePurposeState[]
}

/** One attached image, already resolved to a viewable URL. */
export type BookingThumb = { id: string; url: string; kind: string }

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
