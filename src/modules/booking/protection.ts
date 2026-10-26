import "server-only"

import { headers } from "next/headers"

import type { Db } from "@/db/client"
import {
  findBlockedIdentity,
  listBlockedIdentities,
} from "@/db/blocked-identities"
import { getBookingProtection } from "@/db/booking-protection"
import { humanCheckConfigured } from "@/modules/identity/human-check"
import { requireOwner } from "@/modules/identity/require-owner"
import { createSupabaseServerClient } from "@/platform/supabase/server"
import {
  asBookingAccessLevel,
  blockLookupsFor,
  DEFAULT_BOOKING_PROTECTION,
  type BlockedIdentityView,
  type BlockKind,
  type BookingProtection,
} from "@/shared/booking-protection"

/**
 * The artist's booking-protection settings, and the blocklist check both public
 * write paths run.
 *
 * Every read here fails SAFE rather than open: an unreadable settings table
 * falls back to the middle level with the human check on, because the failure
 * mode of the alternative is a booking form anyone can script.
 */

export async function getBookingProtectionSettings(
  db: Db = createSupabaseServerClient(),
): Promise<BookingProtection> {
  try {
    const row = await getBookingProtection(db)
    if (!row) {
      return DEFAULT_BOOKING_PROTECTION
    }

    return {
      accessLevel: asBookingAccessLevel(row.access_level),
      humanCheck: row.human_check,
    }
  } catch (error) {
    console.error(
      "[protection] settings read failed, using defaults:",
      error instanceof Error ? error.message : error,
    )

    return DEFAULT_BOOKING_PROTECTION
  }
}

/** Her choices plus what the deployment can actually enforce. Separate fields
    on purpose: the toggle is hers, availability is the deploy's, and collapsing
    them is what let a ticked box mean "protected" when nothing was running. */
export type BookingProtectionAdminView = {
  protection: BookingProtection
  /** False when there is no `HUMAN_CHECK_SECRET` to sign a challenge with. */
  humanCheckAvailable: boolean
}

/** The App-settings screen's one question. */
export async function getBookingProtectionForAdmin(): Promise<BookingProtectionAdminView> {
  return {
    protection: await getBookingProtectionSettings(),
    humanCheckAvailable: humanCheckConfigured(),
  }
}

// An IPv4 or IPv6 address and nothing else. This value becomes a rate-limit
// key and a blocklist comparison, so unvalidated header text must never reach
// either — a header is client-writable until a proxy overwrites it.
const IP_ADDRESS = /^[0-9a-f.:]{3,45}$/i

/**
 * The caller's IP, or null if we can't establish one.
 *
 * `x-real-ip` is set by the platform edge and holds exactly one address, so it
 * is preferred. Falling back to `x-forwarded-for`, we take the LAST entry, not
 * the first: the list grows left-to-right as it is forwarded, so a client can
 * prepend whatever it likes to the front, while the rightmost entry is the one
 * our own edge appended.
 *
 * Null (local dev, or anything unparseable) means "nothing to match" — never a
 * blocklist hit, and no IP rate-limit bucket.
 */
export async function callerIp(): Promise<string | null> {
  const head = await headers()
  const candidates = [
    head.get("x-real-ip"),
    head.get("x-forwarded-for")?.split(",").at(-1),
  ]
  for (const candidate of candidates) {
    const value = candidate?.trim().toLowerCase()
    if (value && IP_ADDRESS.test(value)) {
      return value
    }
  }

  return null
}

export type BlockOutcome =
  { blocked: false } | { blocked: true; kind: BlockKind }

/**
 * Is this booker on the blocklist — by address, by email domain, or by IP?
 *
 * Fails OPEN on a read error, on purpose: the blocklist is a manual measure
 * against a handful of known bad actors, and letting a database hiccup refuse
 * every booking would be the worse outcome by a wide margin.
 */
export async function checkBlocked(
  db: Db,
  input: { email: string; ip: string | null },
): Promise<BlockOutcome> {
  try {
    const hit = await findBlockedIdentity(db, blockLookupsFor(input))

    return hit
      ? { blocked: true, kind: hit.kind as BlockKind }
      : { blocked: false }
  } catch (error) {
    console.error(
      "[protection] blocklist read failed, allowing:",
      error instanceof Error ? error.message : error,
    )

    return { blocked: false }
  }
}

/**
 * Is this one address blocked, and which entry did it? Backs the block/unblock
 * action on a client's own page — deliberately email-only: their IP is not
 * something a client page knows, and blocking a whole email provider from a
 * person's profile would be a trap.
 */
export async function getEmailBlock(
  email: string | null | undefined,
): Promise<BlockedIdentityView | null> {
  const value = email?.trim().toLowerCase()
  if (!value) {
    return null
  }
  const db = await requireOwner()
  if (!db) {
    return null
  }
  const hit = await findBlockedIdentity(db, [{ kind: "email", value }]).catch(
    () => null,
  )
  if (!hit) {
    return null
  }

  return {
    id: hit.id,
    kind: hit.kind as BlockKind,
    value: hit.value,
    reason: hit.reason,
    createdAt: hit.created_at,
  }
}

/** The blocklist for the admin screen. Owner-gated here, not by the route —
    the page is behind the proxy, but a read this specific re-checks anyway. */
export async function getBlockedIdentities(): Promise<BlockedIdentityView[]> {
  const db = await requireOwner()
  if (!db) {
    return []
  }
  const rows = await listBlockedIdentities(db).catch(() => [])

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as BlockKind,
    value: row.value,
    reason: row.reason,
    createdAt: row.created_at,
  }))
}
