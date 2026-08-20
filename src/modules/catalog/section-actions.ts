"use server"

import { revalidatePath } from "next/cache"

import { insertAsset } from "@/db/assets"
import {
  deleteSection as deleteSectionRow,
  getAdjacentSection,
  getSectionPosition,
  insertSection,
  nextSortOrder,
  setSectionSortOrder,
  updateSection as updateSectionRow,
  type SectionFields,
} from "@/db/service-sections"
import { requireOwner } from "@/lib/admin/require-owner"
import { publishToPublic } from "@/platform/storage/scaleway"

export type SectionResult = { ok: true } | { ok: false; error: string }

export type SectionInput = {
  titleEn: string
  titleDk: string
  bodyEn: string
  bodyDk: string
  assetId: string | null
}

function toRow(input: SectionInput): SectionFields {
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
  const db = await requireOwner()
  if (!db) return { ok: false, error: "unauthorized" }
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

  const asset = await insertAsset(db, {
    url: published.data.url,
    media_type: "image",
    storage_key: published.data.key,
  })
  if (!asset.ok) return { ok: false, error: "Couldn’t save the image." }
  return { ok: true, assetId: asset.id, url: published.data.url }
}

export async function addSection(
  serviceId: string,
  input: SectionInput,
): Promise<SectionResult> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "unauthorized" }

  const sortOrder = await nextSortOrder(db, serviceId)
  const saved = await insertSection(db, serviceId, sortOrder, toRow(input))
  if (!saved.ok) return { ok: false, error: "Couldn’t add the section." }

  revalidatePath(`/admin/services/${serviceId}`)
  return { ok: true }
}

export async function updateSection(
  sectionId: string,
  input: SectionInput,
): Promise<SectionResult> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "unauthorized" }

  const saved = await updateSectionRow(db, sectionId, toRow(input))
  if (!saved.ok) return { ok: false, error: "Couldn’t save the section." }

  revalidatePath(`/admin/services/${saved.serviceId}`)
  return { ok: true }
}

export async function deleteSection(sectionId: string): Promise<SectionResult> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "unauthorized" }

  const removed = await deleteSectionRow(db, sectionId)
  if (!removed.ok) return { ok: false, error: "Couldn’t remove the section." }

  revalidatePath(`/admin/services/${removed.serviceId}`)
  return { ok: true }
}

/** Reorder by swapping sort_order with the adjacent section. */
export async function moveSection(
  sectionId: string,
  direction: "up" | "down",
): Promise<SectionResult> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "unauthorized" }

  const section = await getSectionPosition(db, sectionId)
  if (!section) return { ok: false, error: "Section not found." }

  const neighbor = await getAdjacentSection(
    db,
    section.service_id,
    section.sort_order,
    direction,
  )
  if (!neighbor) return { ok: true } // already at the edge

  const first = await setSectionSortOrder(db, section.id, neighbor.sort_order)
  if (!first.ok) return { ok: false, error: "Couldn’t reorder." }
  const second = await setSectionSortOrder(db, neighbor.id, section.sort_order)
  if (!second.ok) return { ok: false, error: "Couldn’t reorder." }

  revalidatePath(`/admin/services/${section.service_id}`)
  return { ok: true }
}
