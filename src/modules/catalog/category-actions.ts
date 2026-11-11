"use server"

import {
  insertCategory,
  listAdminCategories,
  nextCategorySortOrder,
  setCategoryArchived,
  setCategoryOrder,
  updateCategory as updateCategoryRow,
} from "@/db/categories"
import { requireOwner } from "@/modules/identity/require-owner"

import { revalidateCatalogSurfaces } from "./revalidate"
import type { CategoryInput, ServiceActionResult } from "./types"
import { nameTaken } from "./validation"

/**
 * Owner-managed category writes. A category is the public menu's top level, so
 * every change revalidates the menu as well as the admin catalog.
 */

/** Null means the check itself failed — treat that as blocking, never as free. */
async function categoryNameTaken(
  db: Parameters<typeof nameTaken>[0],
  nameEn: string,
  nameDk: string,
  excludeId: string | null,
): Promise<boolean | null> {
  return nameTaken(db, "categories", nameEn, nameDk, excludeId).catch(
    () => null,
  )
}

/** Create or edit a category. Names are unique across active categories; a new
    one is appended to the end of the menu. */
export async function saveCategory(
  categoryId: string | null,
  input: CategoryInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const db = await requireOwner()
  if (!db) {
    return { ok: false, error: "unauthorized" }
  }

  const nameEn = input.nameEn.trim()
  if (nameEn.length < 2) {
    return { ok: false, error: "Name is required." }
  }
  const nameDk = input.nameDa.trim() || nameEn

  const taken = await categoryNameTaken(db, nameEn, nameDk, categoryId)
  if (taken === null) {
    return { ok: false, error: "Couldn’t check the name. Try again." }
  }
  if (taken) {
    return { ok: false, error: "Another category already uses that name." }
  }

  const fields = {
    name_en: nameEn,
    name_dk: nameDk,
    description_en: input.descriptionEn.trim() || null,
    description_dk: input.descriptionDa.trim() || null,
    image_url: input.imageUrl,
  }

  if (categoryId) {
    const saved = await updateCategoryRow(db, categoryId, fields)
    if (!saved.ok) {
      return { ok: false, error: "Couldn’t save the category." }
    }
    revalidateCatalogSurfaces()

    return { ok: true, id: categoryId }
  }

  const created = await insertCategory(db, {
    ...fields,
    sort_order: await nextCategorySortOrder(db),
  })
  if (!created.ok) {
    return { ok: false, error: "Couldn’t create the category." }
  }
  revalidateCatalogSurfaces()

  return { ok: true, id: created.id }
}

/** Archive/restore. An archived category drops off the public menu and takes
    its services with it; they stay bookable by direct link. */
export async function archiveCategory(
  categoryId: string,
  archived: boolean,
): Promise<ServiceActionResult> {
  const db = await requireOwner()
  if (!db) {
    return { ok: false, error: "unauthorized" }
  }

  // Restoring rejoins the active set, where names must still be unique.
  if (!archived) {
    const current = (await listAdminCategories(db)).find(
      (category) => category.id === categoryId,
    )
    if (!current) {
      return { ok: false, error: "Category not found." }
    }
    const taken = await categoryNameTaken(
      db,
      current.name_en,
      current.name_dk,
      categoryId,
    )
    if (taken === null) {
      return { ok: false, error: "Couldn’t check the name. Try again." }
    }
    if (taken) {
      return {
        ok: false,
        error: `“${current.name_en}” is already in use — rename it before restoring.`,
      }
    }
  }

  const saved = await setCategoryArchived(
    db,
    categoryId,
    archived ? new Date().toISOString() : null,
  )
  if (!saved.ok) {
    return { ok: false, error: "Couldn’t update the category." }
  }

  revalidateCatalogSurfaces()

  return { ok: true }
}

/** Swap a category with its neighbour — `sort_order` numbers the public menu's
    sections, so this is the only way to change how the menu reads. */
export async function moveCategory(
  categoryId: string,
  direction: "up" | "down",
): Promise<ServiceActionResult> {
  const db = await requireOwner()
  if (!db) {
    return { ok: false, error: "unauthorized" }
  }

  const ids = (await listAdminCategories(db)).map((category) => category.id)
  const from = ids.indexOf(categoryId)
  if (from === -1) {
    return { ok: false, error: "Category not found." }
  }

  const to = direction === "up" ? from - 1 : from + 1
  if (to < 0 || to >= ids.length) {
    return { ok: true } // already at the edge
  }
  ;[ids[from], ids[to]] = [ids[to], ids[from]]

  const saved = await setCategoryOrder(db, ids)
  // The renumber isn't atomic, so a failure may have moved some rows already.
  if (!saved.ok) {
    revalidateCatalogSurfaces()

    return {
      ok: false,
      error: "Couldn’t finish reordering — reload to see the current order.",
    }
  }

  revalidateCatalogSurfaces()

  return { ok: true }
}

/** Update category sort order from an ordered array of IDs. */
export async function updateCategoryOrder(
  orderedIds: string[],
): Promise<ServiceActionResult> {
  const db = await requireOwner()
  if (!db) {
    return { ok: false, error: "unauthorized" }
  }

  const saved = await setCategoryOrder(db, orderedIds)
  if (!saved.ok) {
    revalidateCatalogSurfaces()

    return {
      ok: false,
      error: "Couldn’t finish reordering — reload to see the current order.",
    }
  }

  revalidateCatalogSurfaces()

  return { ok: true }
}
