"use server"

import { revalidatePath } from "next/cache"

import { requireOwner } from "@/lib/admin/require-owner"
import { publishToPublic } from "@/lib/storage/scaleway"

export type SectionResult = { ok: true } | { ok: false; error: string }

export type SectionInput = {
  titleEn: string
  titleDk: string
  bodyEn: string
  bodyDk: string
  assetId: string | null
}

function toRow(input: SectionInput) {
  return {
    title_en: input.titleEn.trim() || null,
    title_dk: input.titleDk.trim() || null,
    body_en: input.bodyEn.trim() || null,
    body_dk: input.bodyDk.trim() || null,
    asset_id: input.assetId,
  }
}

/**
 * Publish a freshly-uploaded studio image (private storage key from uploadMedia)
 * to the public bucket and record it as an asset — so a section can use a brand
 * new image, not only a consented one. Returns the asset id to link.
 */
export async function publishStudioImage(
  storageKey: string,
): Promise<
  { ok: true; assetId: string; url: string } | { ok: false; error: string }
> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }
  if (!storageKey) return { ok: false, error: "No file uploaded." }

  const published = await publishToPublic(storageKey)
  if (!published.ok) {
    return {
      ok: false,
      error:
        published.error === "not_configured"
          ? "Storage isn’t set up yet."
          : "Couldn’t publish the image.",
    }
  }
  const { data, error } = await supabase
    .from("assets")
    .insert({
      url: published.data.url,
      media_type: "image",
      storage_key: published.data.key,
    })
    .select("id")
    .single()
  if (error || !data) return { ok: false, error: "Couldn’t save the image." }
  return { ok: true, assetId: data.id, url: published.data.url }
}

export async function addSection(
  serviceId: string,
  input: SectionInput,
): Promise<SectionResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const { data: last } = await supabase
    .from("service_sections")
    .select("sort_order")
    .eq("service_id", serviceId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()
  const sortOrder = (last?.sort_order ?? -1) + 1

  const { error } = await supabase
    .from("service_sections")
    .insert({ service_id: serviceId, sort_order: sortOrder, ...toRow(input) })
  if (error) return { ok: false, error: "Couldn’t add the section." }

  revalidatePath(`/admin/services/${serviceId}`)
  return { ok: true }
}

export async function updateSection(
  sectionId: string,
  input: SectionInput,
): Promise<SectionResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const { data, error } = await supabase
    .from("service_sections")
    .update(toRow(input))
    .eq("id", sectionId)
    .select("service_id")
    .single()
  if (error || !data) return { ok: false, error: "Couldn’t save the section." }

  revalidatePath(`/admin/services/${data.service_id}`)
  return { ok: true }
}

export async function deleteSection(
  sectionId: string,
): Promise<SectionResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const { data, error } = await supabase
    .from("service_sections")
    .delete()
    .eq("id", sectionId)
    .select("service_id")
    .single()
  if (error || !data) return { ok: false, error: "Couldn’t remove the section." }

  revalidatePath(`/admin/services/${data.service_id}`)
  return { ok: true }
}

/** Reorder by swapping sort_order with the adjacent section. */
export async function moveSection(
  sectionId: string,
  direction: "up" | "down",
): Promise<SectionResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const { data: section } = await supabase
    .from("service_sections")
    .select("id, service_id, sort_order")
    .eq("id", sectionId)
    .maybeSingle()
  if (!section) return { ok: false, error: "Section not found." }

  const neighborQuery = supabase
    .from("service_sections")
    .select("id, sort_order")
    .eq("service_id", section.service_id)
  const { data: neighbors } =
    direction === "up"
      ? await neighborQuery
          .lt("sort_order", section.sort_order)
          .order("sort_order", { ascending: false })
          .limit(1)
      : await neighborQuery
          .gt("sort_order", section.sort_order)
          .order("sort_order", { ascending: true })
          .limit(1)
  const neighbor = neighbors?.[0]
  if (!neighbor) return { ok: true } // already at the edge

  await supabase
    .from("service_sections")
    .update({ sort_order: neighbor.sort_order })
    .eq("id", section.id)
  await supabase
    .from("service_sections")
    .update({ sort_order: section.sort_order })
    .eq("id", neighbor.id)

  revalidatePath(`/admin/services/${section.service_id}`)
  return { ok: true }
}
