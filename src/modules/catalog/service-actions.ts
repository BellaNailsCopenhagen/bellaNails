"use server"

import { revalidatePath } from "next/cache"

import {
  getServicePricing,
  insertService,
  setServiceArchived,
  updateService as updateServiceRow,
} from "@/db/services"
import { listPriceHistory, recordPricePoint, type PricePoint } from "@/db/price-history"
import { requireOwner } from "@/modules/identity/require-owner"

import type {
  ServiceActionResult,
  ServiceCreateInput,
  ServiceEditInput,
} from "./types"
import { krToCents, nameTaken } from "./validation"

/**
 * Owner-managed service writes. Every action re-verifies the owner role (the UI
 * is never the boundary) and writes with the service-role client.
 */

function revalidateService(id: string) {
  revalidatePath("/admin/services")
  revalidatePath(`/admin/services/${id}`)
}

/** Price history for one catalog item, newest first — for the edit dialog. */
export async function getPriceHistory(
  entityType: "service" | "addon",
  entityId: string,
): Promise<PricePoint[]> {
  const db = await requireOwner()
  if (!db) return []
  return listPriceHistory(db, entityType, entityId)
}

/** Create a service. Availability is the in-house engine's job — no external
    calendar to provision. */
export async function createService(
  input: ServiceCreateInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "unauthorized" }

  const nameEn = input.nameEn.trim()
  if (nameEn.length < 2) return { ok: false, error: "Name is required." }
  const nameDk = input.nameDa.trim() || nameEn
  const cents = krToCents(input.priceKr)
  if (cents === null) return { ok: false, error: "Price is invalid." }
  if (!Number.isInteger(input.durationMins) || input.durationMins <= 0) {
    return { ok: false, error: "Duration is invalid." }
  }
  if (await nameTaken(db, "services", nameEn, nameDk, null)) {
    return { ok: false, error: "Another service already uses that name." }
  }

  const created = await insertService(db, {
    name_en: nameEn,
    name_dk: nameDk,
    base_price_cents: cents,
    base_duration_mins: input.durationMins,
    category_id: input.categoryId,
  })
  if (!created.ok) return { ok: false, error: "Couldn’t create the service." }

  await recordPricePoint(db, "service", created.id, cents)
  revalidatePath("/admin/services")
  return { ok: true, id: created.id }
}

export async function updateService(
  id: string,
  input: ServiceEditInput,
): Promise<ServiceActionResult> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "unauthorized" }

  const nameEn = input.nameEn.trim()
  if (nameEn.length < 2) return { ok: false, error: "Name is required." }
  const nameDk = input.nameDa.trim() || nameEn
  const cents = krToCents(input.priceKr)
  if (cents === null) return { ok: false, error: "Price is invalid." }
  if (!Number.isInteger(input.durationMins) || input.durationMins <= 0) {
    return { ok: false, error: "Duration is invalid." }
  }
  if (await nameTaken(db, "services", nameEn, nameDk, id)) {
    return { ok: false, error: "Another service already uses that name." }
  }

  const current = await getServicePricing(db, id)
  if (!current) return { ok: false, error: "Service not found." }

  const saved = await updateServiceRow(db, id, {
    name_en: nameEn,
    name_dk: nameDk,
    description_en: input.descriptionEn.trim() || null,
    description_dk: input.descriptionDa.trim() || null,
    base_price_cents: cents,
    base_duration_mins: input.durationMins,
  })
  if (!saved.ok) return { ok: false, error: "Couldn’t save the service." }

  if (current.base_price_cents !== cents) {
    await recordPricePoint(db, "service", id, cents)
  }

  revalidateService(id)
  return { ok: true }
}

export async function archiveService(
  id: string,
  archived: boolean,
): Promise<ServiceActionResult> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "unauthorized" }

  const saved = await setServiceArchived(
    db,
    id,
    archived ? new Date().toISOString() : null,
  )
  if (!saved.ok) return { ok: false, error: "Couldn’t update the service." }

  // Archived services are filtered out of every public read, so they can no
  // longer be booked — no external calendar to hide.
  revalidateService(id)
  return { ok: true }
}
