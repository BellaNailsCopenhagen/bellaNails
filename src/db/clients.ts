import type { Locale } from "@/i18n/routing"
import { redactedEmail } from "@/shared/anonymize"

import type { Db, Row } from "./client"

/** `clients` — one row per person the studio knows, whether they signed in or
    were created by a Cal booking. `auth_user_id` links a row to a login;
    `anonymized_at` marks an erased row that must never be re-hydrated. */

export type ClientContactRow = Pick<
  Row<"clients">,
  | "id"
  | "name"
  | "email"
  | "phone"
  | "auth_user_id"
  | "anonymized_at"
  | "communication_locale"
>

export type ClientProfile = Pick<Row<"clients">, "name" | "phone" | "email">

/** Contact rows for a set of client ids — the admin booking resolve. */
export async function listClientContacts(
  db: Db,
  ids: string[],
): Promise<ClientContactRow[]> {
  if (ids.length === 0) {
    return []
  }
  const { data } = await db
    .from("clients")
    .select(
      "id, name, email, phone, auth_user_id, anonymized_at, communication_locale",
    )
    .in("id", ids)

  return data ?? []
}

/** The signed-in person's own editable profile. */
export async function getClientProfile(
  db: Db,
  clientId: string,
): Promise<ClientProfile | null> {
  const { data } = await db
    .from("clients")
    .select("name, phone, email")
    .eq("id", clientId)
    .maybeSingle()

  return data ?? null
}

/** Resolve a login to its clients row. */
export async function findClientByAuthUser(
  db: Db,
  authUserId: string,
): Promise<Pick<Row<"clients">, "id" | "name" | "phone"> | null> {
  const { data } = await db
    .from("clients")
    .select("id, name, phone")
    .eq("auth_user_id", authUserId)
    .maybeSingle()

  return data ?? null
}

/** Just the id — the browser hook that resolves the current client. */
export async function findClientIdByAuthUser(
  db: Db,
  authUserId: string,
): Promise<string | null> {
  const { data } = await db
    .from("clients")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle()

  return data?.id ?? null
}

export async function findClientByEmail(
  db: Db,
  email: string,
): Promise<Pick<Row<"clients">, "id" | "name" | "phone"> | null> {
  const { data } = await db
    .from("clients")
    .select("id, name, phone")
    .eq("email", email)
    .maybeSingle()

  return data ?? null
}

export async function findClientIdByEmail(
  db: Db,
  email: string,
): Promise<string | null> {
  const { data } = await db
    .from("clients")
    .select("id")
    .eq("email", email)
    .maybeSingle()

  return data?.id ?? null
}

/** Erasure state — read before anonymizing so a retry is idempotent. */
export async function getClientErasureState(
  db: Db,
  clientId: string,
): Promise<
  | {
      ok: true
      row: Pick<Row<"clients">, "id" | "auth_user_id" | "anonymized_at"> | null
    }
  | { ok: false; message: string }
> {
  const { data, error } = await db
    .from("clients")
    .select("id, auth_user_id, anonymized_at")
    .eq("id", clientId)
    .maybeSingle()
  if (error) {
    return { ok: false, message: error.message }
  }

  return { ok: true, row: data ?? null }
}

export async function insertClient(
  db: Db,
  values: { email: string; name: string | null; phone: string | null },
): Promise<
  { ok: true; id: string } | { ok: false; message: string; code?: string }
> {
  const { data, error } = await db
    .from("clients")
    .insert(values)
    .select("id")
    .single()
  // Return the PG error code (no PII) so callers can log it without the message,
  // which can echo the email on a unique-violation (Key (email)=(…)).
  if (error || !data) {
    return { ok: false, message: error?.message ?? "no row", code: error?.code }
  }

  return { ok: true, id: data.id }
}

export async function updateClientContact(
  db: Db,
  clientId: string,
  patch: { name?: string; phone?: string },
): Promise<{ ok: boolean }> {
  const { error } = await db.from("clients").update(patch).eq("id", clientId)

  return { ok: !error }
}

/** Set which language a client's emails use. Returns `{ ok: false }` (never
    throws) so a caller can treat a pre-migration missing column as best-effort. */
export async function updateClientCommunicationLocale(
  db: Db,
  clientId: string,
  locale: Locale,
): Promise<{ ok: boolean }> {
  const { error } = await db
    .from("clients")
    .update({ communication_locale: locale })
    .eq("id", clientId)

  return { ok: !error }
}

/** The person's own profile edit — also stamps `updated_at`. */
export async function updateClientProfile(
  db: Db,
  clientId: string,
  values: { name: string | null; phone: string | null },
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await db
    .from("clients")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", clientId)

  return error ? { ok: false, message: error.message } : { ok: true }
}

/** Redact every identifying column and unlink the login (GDPR erasure). The
    row itself stays so bookings keep their (now anonymous) history. */
export async function anonymizeClientRow(
  db: Db,
  clientId: string,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await db
    .from("clients")
    .update({
      name: null,
      phone: null,
      email: redactedEmail(clientId),
      auth_user_id: null,
      anonymized_at: new Date().toISOString(),
    })
    .eq("id", clientId)

  return error ? { ok: false, message: error.message } : { ok: true }
}
