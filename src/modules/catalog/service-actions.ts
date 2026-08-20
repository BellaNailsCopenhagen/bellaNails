"use server"

import { revalidatePath } from "next/cache"

import {
  getServiceCalEventId,
  getServicePricing,
  insertService,
  setServiceArchived,
  updateService as updateServiceRow,
} from "@/db/services"
import { listPriceHistory, recordPricePoint, type PricePoint } from "@/db/price-history"
import { requireOwner } from "@/modules/identity/require-owner"
import { createCalEventType, patchCalEventType } from "@/platform/cal/event-types"
import { computeSlotOptions } from "@/shared/booking-totals"

import { resyncSlotOptions } from "./slot-sync"
import type {
  ServiceActionResult,
  ServiceCreateInput,
  ServiceEditInput,
} from "./types"
import { calSlugFor, krToCents, nameTaken } from "./validation"

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

/** Create a service — its Cal event type is created first (the slug/id are
    NOT NULL), then the row. Fails without side effects if Cal rejects. */
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

  const cal = await createCalEventType({
    title: nameEn,
    slug: calSlugFor(nameEn),
    lengthInMinutes: input.durationMins,
    lengthInMinutesOptions: computeSlotOptions(input.durationMins, [], []),
  })
  if (!cal.ok) return { ok: false, error: `Cal sync failed: ${cal.error}` }

  const created = await insertService(db, {
    name_en: nameEn,
    name_dk: nameDk,
    base_price_cents: cents,
    base_duration_mins: input.durationMins,
    category_id: input.categoryId,
    cal_event_id: cal.data.id,
    cal_event_slug: cal.data.slug,
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
  const durationChanged = current.base_duration_mins !== input.durationMins

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

  // Name/price/description don't touch Cal; duration does.
  let syncError: string | undefined
  if (durationChanged) {
    const sync = await resyncSlotOptions(db, id)
    if (!sync.ok) syncError = sync.error
  }

  revalidateService(id)
  return { ok: true, syncError }
}

export async function archiveService(
  id: string,
  archived: boolean,
): Promise<ServiceActionResult> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "unauthorized" }

  const service = await getServiceCalEventId(db, id)
  if (!service) return { ok: false, error: "Service not found." }

  const saved = await setServiceArchived(
    db,
    id,
    archived ? new Date().toISOString() : null,
  )
  if (!saved.ok) return { ok: false, error: "Couldn’t update the service." }

  // Hide/show the Cal event type so archived services can't be booked.
  let syncError: string | undefined
  if (service.cal_event_id) {
    const sync = await patchCalEventType(service.cal_event_id, {
      hidden: archived,
    })
    if (!sync.ok) syncError = sync.error
  }

  revalidateService(id)
  return { ok: true, syncError }
}
