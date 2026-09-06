import type { Db, Row } from "./client"

/** `business_profile` — ONE row (boolean PK) with the business's public
    contact, its mail send-as alias, and its social links. Public-read;
    owner-written. */

export type BusinessProfileRow = Row<"business_profile">

/** A read failure, carrying the PostgREST code so the caller can tell an
    un-migrated table from a real fault. */
export class BusinessProfileReadError extends Error {
  constructor(
    message: string,
    readonly code: string | undefined,
  ) {
    super(message)
    this.name = "BusinessProfileReadError"
  }
}

/** Postgres "relation does not exist", and PostgREST's schema-cache miss for
    the same thing — i.e. the migration has not been applied. */
const MISSING_TABLE = new Set(["42P01", "PGRST205"])

export const isMissingTable = (error: unknown): boolean =>
  error instanceof BusinessProfileReadError && MISSING_TABLE.has(error.code ?? "")

/**
 * The row, or null when there simply isn't one yet.
 *
 * THROWS on a read error rather than returning null: the caller degrades to the
 * compiled-in defaults either way, but "no row", "not migrated yet" and "the
 * query failed" want three different log lines, and swallowing them here made
 * the caller's handler dead code.
 */
export async function getBusinessProfileRow(
  db: Db,
): Promise<BusinessProfileRow | null> {
  const { data, error } = await db
    .from("business_profile")
    .select("*")
    .maybeSingle()
  if (error) throw new BusinessProfileReadError(error.message, error.code)
  return data ?? null
}

export async function upsertBusinessProfile(
  db: Db,
  values: {
    contact_email?: string | null
    booking_from_email?: string | null
    alert_email?: string | null
    address_line_1?: string | null
    address_line_2?: string | null
    map_image_key?: string | null
    hero_asset_key?: string | null
    instagram_url?: string | null
    facebook_url?: string | null
    tiktok_url?: string | null
  },
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await db
    .from("business_profile")
    .upsert(
      { id: true, ...values, updated_at: new Date().toISOString() },
      { onConflict: "id" },
    )
  return error ? { ok: false, message: error.message } : { ok: true }
}
