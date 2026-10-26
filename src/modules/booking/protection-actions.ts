"use server"

import { revalidatePath } from "next/cache"

import {
  deleteBlockedIdentity,
  insertBlockedIdentity,
} from "@/db/blocked-identities"
import { upsertBookingProtection } from "@/db/booking-protection"
import { requireOwner } from "@/modules/identity/require-owner"
import {
  BLOCK_KINDS,
  isSelectableLevel,
  normalizeBlockValue,
  BOOKING_ACCESS_LEVELS,
  type BlockKind,
  type BookingAccessLevel,
} from "@/shared/booking-protection"
import { EMAIL_PATTERN } from "@/shared/contact-validation"
import { revalidatePatterns, routes } from "@/shared/routes"

/**
 * The artist's controls over how hard it is to book. Owner-only, and every
 * value is re-validated here — the select and the radio group are convenience,
 * not the boundary.
 */

export type ProtectionResult = { ok: true } | { ok: false; error: string }

const MAX_REASON = 200
// Long enough for an IPv6 address or a real email, short enough to bound the row.
const MAX_VALUE = 254

export async function setBookingAccessLevel(
  level: string,
): Promise<ProtectionResult> {
  const db = await requireOwner()
  if (!db) {
    return { ok: false, error: "unauthorized" }
  }

  if (!(BOOKING_ACCESS_LEVELS as readonly string[]).includes(level)) {
    return { ok: false, error: "Unknown protection level." }
  }
  // `card` is a real level with no implementation behind it (feature G), so
  // storing it would silently mean "verified" — refuse instead of pretending.
  if (!isSelectableLevel(level as BookingAccessLevel)) {
    return {
      ok: false,
      error:
        "Card on file needs card payments set up first — not available yet.",
    }
  }

  const saved = await upsertBookingProtection(db, { access_level: level })
  if (!saved.ok) {
    return { ok: false, error: "Couldn’t save that." }
  }

  revalidateProtection()

  return { ok: true }
}

export async function setBookingHumanCheck(
  enabled: boolean,
): Promise<ProtectionResult> {
  const db = await requireOwner()
  if (!db) {
    return { ok: false, error: "unauthorized" }
  }

  const saved = await upsertBookingProtection(db, { human_check: enabled })
  if (!saved.ok) {
    return { ok: false, error: "Couldn’t save that." }
  }

  revalidateProtection()

  return { ok: true }
}

export async function blockIdentity(input: {
  kind: string
  value: string
  reason: string
}): Promise<ProtectionResult> {
  const db = await requireOwner()
  if (!db) {
    return { ok: false, error: "unauthorized" }
  }

  if (!(BLOCK_KINDS as readonly string[]).includes(input.kind)) {
    return { ok: false, error: "Pick what you're blocking." }
  }
  const kind = input.kind as BlockKind
  const value = normalizeBlockValue(kind, input.value).slice(0, MAX_VALUE)
  if (!value) {
    return { ok: false, error: "Enter what to block." }
  }
  // A comma or a paren would break the PostgREST `or` filter the lookup builds,
  // and no legitimate address, domain or IP contains one.
  if (/[(),\s]/.test(value)) {
    return { ok: false, error: "That doesn't look valid." }
  }
  if (kind === "email" && !EMAIL_PATTERN.test(value)) {
    return { ok: false, error: "Enter a full email address." }
  }
  if (kind === "domain" && !value.includes(".")) {
    return { ok: false, error: "Enter a domain, like mailinator.com." }
  }

  const reason = input.reason.trim().slice(0, MAX_REASON)
  // Required by the table too. A blocklist nobody can explain later is a list
  // nobody dares remove from.
  if (!reason) {
    return { ok: false, error: "Say why — you'll want to know later." }
  }

  const saved = await insertBlockedIdentity(db, { kind, value, reason })
  if (!saved.ok) {
    const duplicate = /duplicate key|unique constraint/i.test(
      saved.message ?? "",
    )

    return {
      ok: false,
      error: duplicate ? "That's already blocked." : "Couldn’t block that.",
    }
  }

  revalidateProtection()

  return { ok: true }
}

export async function unblockIdentity(id: string): Promise<ProtectionResult> {
  const db = await requireOwner()
  if (!db) {
    return { ok: false, error: "unauthorized" }
  }

  const removed = await deleteBlockedIdentity(db, id)
  if (!removed.ok) {
    return { ok: false, error: "Couldn’t remove that." }
  }

  revalidateProtection()

  return { ok: true }
}

/** The level + human check live in App settings; the blocklist is shown under
    Clients and on each client's own page. Cheap enough to refresh all three. */
function revalidateProtection(): void {
  revalidatePath(routes.admin.settings)
  revalidatePath(routes.admin.clients)
  revalidatePath(revalidatePatterns.adminClient, "page")
}
