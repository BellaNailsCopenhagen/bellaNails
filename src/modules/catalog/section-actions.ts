"use server"

import { revalidatePath } from "next/cache"

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
import { requireOwner } from "@/modules/identity/require-owner"
import { routes } from "@/shared/routes"

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

export async function addSection(
  serviceId: string,
  input: SectionInput,
): Promise<SectionResult> {
  const db = await requireOwner()
  if (!db) {
    return { ok: false, error: "unauthorized" }
  }

  const sortOrder = await nextSortOrder(db, serviceId)
  const saved = await insertSection(db, serviceId, sortOrder, toRow(input))
  if (!saved.ok) {
    return { ok: false, error: "Couldn’t add the section." }
  }

  revalidatePath(routes.admin.service(serviceId))

  return { ok: true }
}

export async function updateSection(
  sectionId: string,
  input: SectionInput,
): Promise<SectionResult> {
  const db = await requireOwner()
  if (!db) {
    return { ok: false, error: "unauthorized" }
  }

  const saved = await updateSectionRow(db, sectionId, toRow(input))
  if (!saved.ok) {
    return { ok: false, error: "Couldn’t save the section." }
  }

  revalidatePath(routes.admin.service(saved.serviceId))

  return { ok: true }
}

export async function deleteSection(sectionId: string): Promise<SectionResult> {
  const db = await requireOwner()
  if (!db) {
    return { ok: false, error: "unauthorized" }
  }

  const removed = await deleteSectionRow(db, sectionId)
  if (!removed.ok) {
    return { ok: false, error: "Couldn’t remove the section." }
  }

  revalidatePath(routes.admin.service(removed.serviceId))

  return { ok: true }
}

/** Reorder by swapping sort_order with the adjacent section. */
export async function moveSection(
  sectionId: string,
  direction: "up" | "down",
): Promise<SectionResult> {
  const db = await requireOwner()
  if (!db) {
    return { ok: false, error: "unauthorized" }
  }

  const section = await getSectionPosition(db, sectionId)
  if (!section) {
    return { ok: false, error: "Section not found." }
  }

  const neighbor = await getAdjacentSection(
    db,
    section.service_id,
    section.sort_order,
    direction,
  )
  if (!neighbor) {
    return { ok: true }
  } // already at the edge

  const first = await setSectionSortOrder(db, section.id, neighbor.sort_order)
  if (!first.ok) {
    return { ok: false, error: "Couldn’t reorder." }
  }
  const second = await setSectionSortOrder(db, neighbor.id, section.sort_order)
  if (!second.ok) {
    return { ok: false, error: "Couldn’t reorder." }
  }

  revalidatePath(routes.admin.service(section.service_id))

  return { ok: true }
}
