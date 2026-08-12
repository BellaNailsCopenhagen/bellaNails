import type { SupabaseClient } from "@supabase/supabase-js"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/types"
import { pickLocalized } from "@/lib/i18n/localized"

/**
 * Terms documents: `service` (booking) and `data` (data-use / media consent).
 * Each kind keeps a version history with a single current version. Public pages
 * render the current version; acceptance rows pin the version a client accepted.
 */

export type TermsKind = "service" | "data"
export const TERMS_KINDS: readonly TermsKind[] = ["service", "data"]

export function isTermsKind(value: string): value is TermsKind {
  return value === "service" || value === "data"
}

export type TermsRecord = {
  id: string
  kind: TermsKind
  version: number
  titleEn: string | null
  titleDk: string | null
  bodyEn: string | null
  bodyDk: string | null
  isCurrent: boolean
  createdAt: string
}

export type LocalizedTerms = {
  id: string
  kind: TermsKind
  version: number
  title: string
  body: string
}

type Client = SupabaseClient<Database>

type TermsRow = Database["public"]["Tables"]["terms"]["Row"]

function toRecord(row: TermsRow): TermsRecord {
  return {
    id: row.id,
    kind: isTermsKind(row.kind) ? row.kind : "service",
    version: row.version,
    titleEn: row.title_en,
    titleDk: row.title_dk,
    bodyEn: row.body_en,
    bodyDk: row.body_dk,
    isCurrent: row.is_current,
    createdAt: row.created_at,
  }
}

/** Resolve a record to the active locale (English fallback). */
export function localizeTerms(
  record: TermsRecord,
  locale: string,
): LocalizedTerms {
  return {
    id: record.id,
    kind: record.kind,
    version: record.version,
    title: pickLocalized(locale, record.titleEn, record.titleDk) ?? "",
    body: pickLocalized(locale, record.bodyEn, record.bodyDk) ?? "",
  }
}

/** The current version of one kind, or null (unset, or table not applied yet). */
export async function getCurrentTerms(
  kind: TermsKind,
  supabase: Client = createSupabaseServerClient(),
): Promise<TermsRecord | null> {
  const { data, error } = await supabase
    .from("terms")
    .select("*")
    .eq("kind", kind)
    .eq("is_current", true)
    .maybeSingle()
  if (error || !data) return null
  return toRecord(data)
}

/** Full version history for one kind, newest first — for the admin history list. */
export async function getTermsVersions(
  kind: TermsKind,
  supabase: Client = createSupabaseServerClient(),
): Promise<TermsRecord[]> {
  const { data, error } = await supabase
    .from("terms")
    .select("*")
    .eq("kind", kind)
    .order("version", { ascending: false })
  if (error || !data) return []
  return data.map(toRecord)
}
