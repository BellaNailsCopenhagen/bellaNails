import type { Db, Row } from "./client"

/** `blocked_identities` — the studio's manual blocklist (an address, a whole
    email domain, or an IP). Owner-only under RLS; the public booking path
    checks it with the service-role client, because an anon-readable blocklist
    would tell a scraper exactly which identities to stop using. */

export type BlockedIdentityRow = Row<"blocked_identities">

/**
 * The first of these (kind, value) pairs that is blocked, or null.
 *
 * One query with an `or` of equality tests — a booker is checked against their
 * address, its domain and their IP at once, and every comparison hits the
 * (kind, value) index.
 */
export async function findBlockedIdentity(
  db: Db,
  lookups: { kind: string; value: string }[],
): Promise<BlockedIdentityRow | null> {
  if (!lookups.length) return null
  const filter = lookups
    // The values are normalised (lowercased, trimmed) and a comma or paren
    // would break out of PostgREST's `or` grammar, so refuse rather than escape.
    .filter((l) => !/[(),]/.test(l.value))
    .map((l) => `and(kind.eq.${l.kind},value.eq.${l.value})`)
    .join(",")
  if (!filter) return null

  const { data } = await db
    .from("blocked_identities")
    .select("*")
    .or(filter)
    .limit(1)
    .maybeSingle()
  return data ?? null
}

export async function listBlockedIdentities(
  db: Db,
): Promise<BlockedIdentityRow[]> {
  const { data } = await db
    .from("blocked_identities")
    .select("*")
    .order("created_at", { ascending: false })
  return data ?? []
}

export async function insertBlockedIdentity(
  db: Db,
  values: { kind: string; value: string; reason: string },
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await db.from("blocked_identities").insert(values)
  return error ? { ok: false, message: error.message } : { ok: true }
}

export async function deleteBlockedIdentity(
  db: Db,
  id: string,
): Promise<{ ok: boolean }> {
  const { error } = await db.from("blocked_identities").delete().eq("id", id)
  return { ok: !error }
}
