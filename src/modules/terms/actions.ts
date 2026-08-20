"use server"

import { revalidatePath } from "next/cache"

import {
  clearCurrentTerms,
  getLatestVersion,
  insertTerms,
  setTermsCurrent,
} from "@/db/terms"
import { requireOwner } from "@/modules/identity/require-owner"
import { isTermsKind, type TermsKind } from "@/modules/terms/terms"

export type TermsActionResult = { ok: true } | { ok: false; error: string }

export type TermsInput = {
  titleEn: string
  titleDk: string
  bodyEn: string
  bodyDk: string
}

/**
 * Publish a new current version of a terms document. Saving always creates the
 * next version (never edits history in place) so every recorded acceptance
 * keeps pointing at the exact text the client agreed to. The current flag is
 * swapped after the insert so there's never a moment with two current versions
 * (the partial unique index would reject it).
 */
export async function saveTermsVersion(
  kind: TermsKind,
  input: TermsInput,
): Promise<TermsActionResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }
  if (!isTermsKind(kind)) return { ok: false, error: "Unknown terms type." }

  const nextVersion = (await getLatestVersion(supabase, kind)) + 1

  const inserted = await insertTerms(supabase, {
    kind,
    version: nextVersion,
    title_en: input.titleEn.trim() || null,
    title_dk: input.titleDk.trim() || null,
    body_en: input.bodyEn.trim() || null,
    body_dk: input.bodyDk.trim() || null,
    is_current: false,
  })
  if (!inserted.ok) return { ok: false, error: "Couldn’t save the terms." }

  // Swap current: clear the old, then promote the new (never two at once — the
  // partial unique index forbids it). Both are error-checked so a half-done swap
  // is reported rather than silently leaving the kind with no current version.
  const cleared = await clearCurrentTerms(supabase, kind)
  if (!cleared.ok) return { ok: false, error: "Couldn’t publish the terms." }

  const promoted = await setTermsCurrent(supabase, inserted.id)
  if (!promoted.ok) return { ok: false, error: "Couldn’t publish the terms." }

  revalidatePath("/admin/terms")
  return { ok: true }
}
