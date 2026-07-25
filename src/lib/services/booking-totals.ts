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
  /**
   * The Cal.com slot length: `totalMins` rounded UP to the base duration's
   * 15-minute grid (the steps each event type offers). Over-reserving ≤14
   * minutes is fine; under-reserving would collide back-to-back bookings —
   * never round down.
   */
  slotMins: number
}

/**
 * The one place booking totals are computed — the summary card, the embed
 * handoff, and the notes summary all read from here so the numbers can't
 * disagree between steps.
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
  const slotMins =
    service.durationMins +
    Math.ceil((totalMins - service.durationMins) / 15) * 15

  return { totalCents, totalMins, slotMins }
}

/**
 * Every slot length the customizer can produce for a service: the base
 * duration plus every COMPATIBLE add-on combination, each rounded UP the same
 * way `computeBookingTotals.slotMins` rounds (add-on time to the 15-min grid).
 * This is the exact set that must go into Cal's `lengthInMinutesOptions` — the
 * invariant the 60-vs-75 under-reservation incident violated.
 *
 * O(2^n) over add-ons; studio services have a handful, so a cap guards the
 * pathological case. Above it we can't enumerate combinations, so we emit the
 * whole 15-min grid from base to base+all-extras: a superset that still
 * contains every reachable combo's length (never under-offers → never
 * under-reserves), just with some unreachable lengths the booking gate rejects.
 */
export function computeSlotOptions(
  baseDurationMins: number,
  addons: { id: string; extraDurationMins: number }[],
  incompatiblePairs: [string, string][],
): number[] {
  const slotFor = (extra: number) =>
    baseDurationMins + Math.ceil(extra / 15) * 15

  const n = addons.length
  if (n > 16) {
    const allExtra = addons.reduce((sum, a) => sum + a.extraDurationMins, 0)
    const grid = new Set<number>()
    for (let extra = 0; extra <= allExtra; extra += 15) grid.add(slotFor(extra))
    grid.add(slotFor(allExtra))
    return [...grid].sort((a, b) => a - b)
  }

  const options = new Set<number>()
  for (let mask = 0; mask < 1 << n; mask++) {
    const chosen = new Set<string>()
    let extra = 0
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        chosen.add(addons[i].id)
        extra += addons[i].extraDurationMins
      }
    }
    const clashes = incompatiblePairs.some(
      ([a, b]) => chosen.has(a) && chosen.has(b),
    )
    if (!clashes) options.add(slotFor(extra))
  }
  return [...options].sort((a, b) => a - b)
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
    if (!valid.has(id) || kept.includes(id)) continue
    const clashes = incompatiblePairs.some(
      ([a, b]) =>
        (a === id && kept.includes(b)) || (b === id && kept.includes(a)),
    )
    if (!clashes) kept.push(id)
  }
  return kept
}

export type { BookingTotals }
