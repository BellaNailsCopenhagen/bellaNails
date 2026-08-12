"use server"

import { revalidatePath } from "next/cache"

import { requireOwner } from "@/lib/admin/require-owner"
import { isTermsKind, type TermsKind } from "@/lib/terms"

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

  const { data: latest } = await supabase
    .from("terms")
    .select("version")
    .eq("kind", kind)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextVersion = (latest?.version ?? 0) + 1

  const { data: inserted, error: insertError } = await supabase
    .from("terms")
    .insert({
      kind,
      version: nextVersion,
      title_en: input.titleEn.trim() || null,
      title_dk: input.titleDk.trim() || null,
      body_en: input.bodyEn.trim() || null,
      body_dk: input.bodyDk.trim() || null,
      is_current: false,
    })
    .select("id")
    .single()
  if (insertError || !inserted) {
    return { ok: false, error: "Couldn’t save the terms." }
  }

  // Swap current: clear the old, then promote the new (never two at once — the
  // partial unique index forbids it). Both are error-checked so a half-done swap
  // is reported rather than silently leaving the kind with no current version.
  const { error: clearError } = await supabase
    .from("terms")
    .update({ is_current: false })
    .eq("kind", kind)
    .eq("is_current", true)
  if (clearError) return { ok: false, error: "Couldn’t publish the terms." }

  const { error: promoteError } = await supabase
    .from("terms")
    .update({ is_current: true })
    .eq("id", inserted.id)
  if (promoteError) return { ok: false, error: "Couldn’t publish the terms." }

  revalidatePath("/admin/terms")
  return { ok: true }
}
