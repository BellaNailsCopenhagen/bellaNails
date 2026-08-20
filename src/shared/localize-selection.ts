import type { BookingLineItem } from "@/shared/booking-totals"
import { pickLocalized } from "@/shared/localized"

/** The catalog columns this needs, stated structurally so shared/ carries no
    dependency on the catalog module. */
type NamedService = {
  id: string
  name_en: string
  name_dk: string | null
  base_price_cents: number
  base_duration_mins: number
}

type NamedAddon = {
  id: string
  name_en: string
  name_dk: string | null
  extra_price_cents: number
  extra_duration_mins: number
}

/**
 * The one place a service + add-on selection is resolved into localized,
 * display-ready line items — every booking step renders through this, so a
 * client can never see a different name/price on one step than another.
 * Pass `selectedAddonIds` to keep only the chosen add-ons, or omit it for
 * all of them (the customise step lists everything).
 */
export function localizeSelection(
  service: NamedService,
  addons: NamedAddon[],
  locale: string,
  selectedAddonIds?: string[],
): { service: BookingLineItem; addons: BookingLineItem[] } {
  const kept = selectedAddonIds
    ? addons.filter((addon) => selectedAddonIds.includes(addon.id))
    : addons

  return {
    service: {
      id: service.id,
      name:
        pickLocalized(locale, service.name_en, service.name_dk) ??
        service.name_en,
      priceCents: service.base_price_cents,
      durationMins: service.base_duration_mins,
    },
    addons: kept.map((addon) => ({
      id: addon.id,
      name:
        pickLocalized(locale, addon.name_en, addon.name_dk) ?? addon.name_en,
      priceCents: addon.extra_price_cents,
      durationMins: addon.extra_duration_mins,
    })),
  }
}
