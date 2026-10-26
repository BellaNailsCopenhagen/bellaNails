import type { Db, Row } from "./client"

/** `terms` — versioned legal documents. Each `kind` keeps a full history with
    exactly one `is_current` row; documents are never edited in place. */

export type TermsRow = Row<"terms">

/** The published version of one kind. */
export async function getCurrentTerms(
  db: Db,
  kind: string,
): Promise<TermsRow | null> {
  const { data, error } = await db
    .from("terms")
    .select("*")
    .eq("kind", kind)
    .eq("is_current", true)
    .maybeSingle()
  if (error) {
    return null
  }

  return data ?? null
}

/** Full version history for one kind, newest first. */
export async function listTermsVersions(
  db: Db,
  kind: string,
): Promise<TermsRow[]> {
  const { data, error } = await db
    .from("terms")
    .select("*")
    .eq("kind", kind)
    .order("version", { ascending: false })
  if (error) {
    return []
  }

  return data ?? []
}

/** The highest version number issued for a kind; 0 when none exist yet. */
export async function getLatestVersion(db: Db, kind: string): Promise<number> {
  const { data } = await db
    .from("terms")
    .select("version")
    .eq("kind", kind)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.version ?? 0
}

export type TermsInsert = {
  kind: string
  version: number
  title_en: string | null
  title_dk: string | null
  body_en: string | null
  body_dk: string | null
  is_current: boolean
}

export async function insertTerms(
  db: Db,
  values: TermsInsert,
): Promise<{ ok: true; id: string } | { ok: false }> {
  const { data, error } = await db
    .from("terms")
    .insert(values)
    .select("id")
    .single()
  if (error || !data) {
    return { ok: false }
  }

  return { ok: true, id: data.id }
}

/** Demote whatever is current for a kind — step one of publishing. */
export async function clearCurrentTerms(
  db: Db,
  kind: string,
): Promise<{ ok: boolean }> {
  const { error } = await db
    .from("terms")
    .update({ is_current: false })
    .eq("kind", kind)
    .eq("is_current", true)

  return { ok: !error }
}

/** Promote one version to current — step two of publishing. */
export async function setTermsCurrent(
  db: Db,
  id: string,
): Promise<{ ok: boolean }> {
  const { error } = await db
    .from("terms")
    .update({ is_current: true })
    .eq("id", id)

  return { ok: !error }
}
