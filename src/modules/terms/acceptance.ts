import type { Db } from "@/db/client"
import {
  listAcceptancesForClient,
  recordAcceptance,
} from "@/db/terms-acceptances"
import { getCurrentTerms, isTermsKind, type TermsKind } from "@/modules/terms/terms"

type Client = Db

export type TermsAcceptance = {
  id: string
  kind: TermsKind
  version: number
  context: string | null
  referenceId: string
  acceptedAt: string
}

/**
 * Record that a client accepted the current version of a terms document.
 * Best-effort: it never throws (recording must not break booking persistence or
 * consent granting), and it's idempotent per (user, kind, reference) — the
 * first acceptance's version and timestamp stand, so a re-run keeps the truth.
 */
export async function recordTermsAcceptance(
  supabase: Client,
  params: {
    clientId: string
    kind: TermsKind
    context: string
    referenceId?: string
  },
): Promise<void> {
  try {
    const current = await getCurrentTerms(params.kind, supabase)
    if (!current) return // nothing published to accept (or table not applied yet)
    await recordAcceptance(
      supabase,
      {
        client_id: params.clientId,
        terms_id: current.id,
        kind: params.kind,
        version: current.version,
        context: params.context,
        reference_id: params.referenceId ?? "",
      },
      "client_id,kind,reference_id",
    )
  } catch {
    // Swallow — acceptance recording is never allowed to break the primary flow.
  }
}

/** Every acceptance for one client, newest first — for the admin overview. */
export async function getTermsAcceptances(
  supabase: Client,
  clientId: string,
): Promise<TermsAcceptance[]> {
  const data = await listAcceptancesForClient(supabase, clientId)
  return data.map((row) => ({
    id: row.id,
    kind: isTermsKind(row.kind) ? row.kind : "service",
    version: row.version,
    context: row.context,
    referenceId: row.reference_id,
    acceptedAt: row.accepted_at,
  }))
}
