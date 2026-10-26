/**
 * How much a client has to prove before they can book. The artist picks the
 * level in App settings, because every step up costs conversion and only she
 * can price that against the abuse she is actually seeing.
 *
 * Client-safe: pure rules and copy, no server imports.
 */

export const BOOKING_ACCESS_LEVELS = ["open", "verified", "card"] as const
export type BookingAccessLevel = (typeof BOOKING_ACCESS_LEVELS)[number]

export type BookingProtection = {
  accessLevel: BookingAccessLevel
  humanCheck: boolean
}

/**
 * What the app does with no row, and what a failed read falls back to.
 * Deliberately the middle level and the check ON: an unreadable settings table
 * must not quietly throw the booking form open.
 */
export const DEFAULT_BOOKING_PROTECTION: BookingProtection = {
  accessLevel: "verified",
  humanCheck: true,
}

export const asBookingAccessLevel = (value: string): BookingAccessLevel =>
  (BOOKING_ACCESS_LEVELS as readonly string[]).includes(value)
    ? (value as BookingAccessLevel)
    : DEFAULT_BOOKING_PROTECTION.accessLevel

/** Must the booker have confirmed an email address? True from `verified` up. */
export const requiresVerifiedIdentity = (level: BookingAccessLevel): boolean =>
  level !== "open"

/** Must they have a card on file? Feature G — nothing implements this yet, so
    the level is offered but not selectable. */
export const requiresCard = (level: BookingAccessLevel): boolean =>
  level === "card"

/** Levels the app can actually enforce today. `card` needs Stripe. */
export const isSelectableLevel = (level: BookingAccessLevel): boolean =>
  !requiresCard(level)

export const BLOCK_KINDS = ["email", "domain", "ip"] as const
export type BlockKind = (typeof BLOCK_KINDS)[number]

/** Lowercase + trim, and reduce an email to its domain for a `domain` block, so
    a lookup is always an equality test on a value stored the same way. */
export function normalizeBlockValue(kind: BlockKind, raw: string): string {
  const value = raw.trim().toLowerCase()
  if (kind === "domain") {
    return value.replace(/^.*@/, "").replace(/^\.+/, "")
  }

  return value
}

/** One blocklist entry as the admin screen shows it. */
export type BlockedIdentityView = {
  id: string
  kind: BlockKind
  value: string
  reason: string
  createdAt: string
}

/** The values to test one booker against: their address, its domain, their IP. */
export function blockLookupsFor(input: {
  email: string
  ip: string | null
}): { kind: BlockKind; value: string }[] {
  const email = input.email.trim().toLowerCase()
  const lookups: { kind: BlockKind; value: string }[] = [
    { kind: "email", value: email },
  ]
  const domain = email.split("@")[1]
  if (domain) {
    lookups.push({ kind: "domain", value: domain })
  }
  if (input.ip) {
    lookups.push({ kind: "ip", value: input.ip.trim().toLowerCase() })
  }

  return lookups
}
