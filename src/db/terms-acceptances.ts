import type { Db, Row } from "./client"

/** `terms_acceptances` — an immutable record that a client accepted a specific
    terms version in a specific context. Idempotent per (client, terms, context,
    reference) so a redelivered webhook can't double-record. */

export type AcceptanceRow = Pick<
  Row<"terms_acceptances">,
  "id" | "kind" | "version" | "context" | "reference_id" | "accepted_at"
>

export async function listAcceptancesForClient(
  db: Db,
  clientId: string,
): Promise<AcceptanceRow[]> {
  const { data, error } = await db
    .from("terms_acceptances")
    .select("id, kind, version, context, reference_id, accepted_at")
    .eq("client_id", clientId)
    .order("accepted_at", { ascending: false })
  if (error) {
    return []
  }

  return data ?? []
}

export type AcceptanceInsert = {
  client_id: string
  terms_id: string
  kind: string
  version: number
  context: string
  reference_id: string
}

/**
 * Record an acceptance, leaving an existing one alone. `ignoreDuplicates` is
 * the whole point: the first acceptance's version and timestamp are the legal
 * truth, so a redelivered webhook — or a re-run after new terms are published —
 * must not rewrite the row to a version the client never saw.
 */
export async function recordAcceptance(
  db: Db,
  values: AcceptanceInsert,
  onConflict: string,
): Promise<{ ok: boolean }> {
  const { error } = await db
    .from("terms_acceptances")
    .upsert(values, { onConflict, ignoreDuplicates: true })

  return { ok: !error }
}
