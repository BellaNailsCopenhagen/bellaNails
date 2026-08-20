import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/types"
import { getCurrentTerms, isTermsKind, type TermsKind } from "@/lib/terms"

type Client = SupabaseClient<Database>

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
    await supabase.from("terms_acceptances").upsert(
      {
        client_id: params.clientId,
        terms_id: current.id,
        kind: params.kind,
        version: current.version,
        context: params.context,
        reference_id: params.referenceId ?? "",
      },
      { onConflict: "client_id,kind,reference_id", ignoreDuplicates: true },
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
  const { data, error } = await supabase
    .from("terms_acceptances")
    .select("id, kind, version, context, reference_id, accepted_at")
    .eq("client_id", clientId)
    .order("accepted_at", { ascending: false })
  if (error || !data) return []
  return data.map((row) => ({
    id: row.id,
    kind: isTermsKind(row.kind) ? row.kind : "service",
    version: row.version,
    context: row.context,
    referenceId: row.reference_id,
    acceptedAt: row.accepted_at,
  }))
}
