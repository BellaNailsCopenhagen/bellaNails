import type { BookingLineItem } from "@/components/sections/appointment-summary";
import type {
  BookableService,
  ServiceAddon,
} from "@/lib/services/get-service-with-addons";
import { pickLocalized } from "@/lib/i18n/localized";

/**
 * The one place a service + add-on selection is resolved into localized,
 * display-ready line items — every booking step renders through this, so a
 * client can never see a different name/price on one step than another.
 * Pass `selectedAddonIds` to keep only the chosen add-ons, or omit it for
 * all of them (the customise step lists everything).
 */
export function localizeSelection(
  service: Pick<
    BookableService,
    "id" | "name_en" | "name_dk" | "base_price_cents" | "base_duration_mins"
  >,
  addons: ServiceAddon[],
  locale: string,
  selectedAddonIds?: string[],
): { service: BookingLineItem; addons: BookingLineItem[] } {
  const kept = selectedAddonIds
    ? addons.filter((addon) => selectedAddonIds.includes(addon.id))
    : addons;

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
  };
}
