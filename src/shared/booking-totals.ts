/** Localized, display-ready line item — resolved from `_en`/`_dk` upstream.
    Lives in the domain layer so lib and UI share one definition. */
export type BookingLineItem = {
  id: string
  name: string
  priceCents: number
  durationMins: number
}

type BookingTotals = {
  /** Real treatment price, base + selected add-ons. */
  totalCents: number
  /** Real treatment time in minutes — what the client is told. */
  totalMins: number
}

/**
 * The one place booking totals are computed — the summary card and the confirm
 * step read from here so the numbers can't disagree between steps.
 */
export function computeBookingTotals(
  service: BookingLineItem,
  selectedAddons: BookingLineItem[],
): BookingTotals {
  const totalCents =
    service.priceCents +
    selectedAddons.reduce((sum, addon) => sum + addon.priceCents, 0)
  const totalMins =
    service.durationMins +
    selectedAddons.reduce((sum, addon) => sum + addon.durationMins, 0)

  return { totalCents, totalMins }
}

/**
 * Drops add-on ids that don't belong to the service or that clash with an
 * earlier-kept id per `incompatiblePairs` — the server-side counterpart of
 * the customizer's checkbox locking, so a hand-crafted URL can't book (and
 * pay for) a combination the UI forbids. Keep order = URL order.
 */
export function sanitizeSelectedAddonIds(
  requestedIds: string[],
  addons: { id: string }[],
  incompatiblePairs: [string, string][],
): string[] {
  const valid = new Set(addons.map((addon) => addon.id))
  const kept: string[] = []
  for (const id of requestedIds) {
    if (!valid.has(id) || kept.includes(id)) {
      continue
    }
    const clashes = incompatiblePairs.some(
      ([a, b]) =>
        (a === id && kept.includes(b)) || (b === id && kept.includes(a)),
    )
    if (!clashes) {
      kept.push(id)
    }
  }

  return kept
}

export type { BookingTotals }
