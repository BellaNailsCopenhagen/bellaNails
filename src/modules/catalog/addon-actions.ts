"use server"

import { revalidatePath } from "next/cache"

import {
  addIncompatiblePair,
  removeIncompatiblePair,
} from "@/db/addon-incompatibilities"
import {
  getAddonPrice,
  insertAddon,
  setAddonArchived,
  updateAddon,
} from "@/db/addons"
import { recordPricePoint } from "@/db/price-history"
import { linkAddonToService, unlinkAddonFromService } from "@/db/service-addons"
import { requireOwner } from "@/modules/identity/require-owner"
import { routes } from "@/shared/routes"

import type { AddonEditInput, ServiceActionResult } from "./types"
import { krToCents, nameTaken } from "./validation"

/**
 * Add-ons are standalone and reusable: a service links one, it does not own it.
 * Availability is computed live from the catalog by the in-house slot engine,
 * so an add-on change needs no propagation beyond revalidating the pages.
 */

function revalidateService(id: string) {
  revalidatePath(routes.admin.services)
  revalidatePath(routes.admin.service(id))
}

/** Create or edit a STANDALONE add-on (no service link — link separately).
    An edit resyncs every service that already links it (duration may change). */
export async function saveAddon(
  addonId: string | null,
  input: AddonEditInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "unauthorized" }

  const nameEn = input.nameEn.trim()
  if (nameEn.length < 2) return { ok: false, error: "Name is required." }
  const nameDk = input.nameDa.trim() || nameEn
  const cents = krToCents(input.priceKr)
  if (cents === null) return { ok: false, error: "Price is invalid." }
  if (!Number.isInteger(input.durationMins) || input.durationMins < 0) {
    return { ok: false, error: "Duration is invalid." }
  }
  if (await nameTaken(db, "addons", nameEn, nameDk, addonId)) {
    return { ok: false, error: "Another add-on already uses that name." }
  }

  const fields = {
    name_en: nameEn,
    name_dk: nameDk,
    extra_price_cents: cents,
    extra_duration_mins: input.durationMins,
  }

  if (addonId) {
    const priorPrice = await getAddonPrice(db, addonId)
    const saved = await updateAddon(db, addonId, fields)
    if (!saved.ok) return { ok: false, error: "Couldn’t save the add-on." }
    if (priorPrice !== null && priorPrice !== cents) {
      await recordPricePoint(db, "addon", addonId, cents)
    }
    revalidatePath(routes.admin.services)
    return { ok: true, id: addonId }
  }

  const created = await insertAddon(db, fields)
  if (!created.ok) return { ok: false, error: "Couldn’t save the add-on." }
  await recordPricePoint(db, "addon", created.id, cents)
  revalidatePath(routes.admin.services)
  return { ok: true, id: created.id }
}

/** Global archive/restore of an add-on. */
export async function archiveAddon(
  addonId: string,
  archived: boolean,
): Promise<ServiceActionResult> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "unauthorized" }

  const saved = await setAddonArchived(
    db,
    addonId,
    archived ? new Date().toISOString() : null,
  )
  if (!saved.ok) return { ok: false, error: "Couldn’t update the add-on." }

  revalidatePath(routes.admin.services)
  return { ok: true }
}

/** Link an existing add-on to a service (many-to-many). */
export async function linkAddon(
  serviceId: string,
  addonId: string,
): Promise<ServiceActionResult> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "unauthorized" }

  const linked = await linkAddonToService(db, serviceId, addonId)
  if (!linked.ok) return { ok: false, error: "Couldn’t link the add-on." }

  revalidateService(serviceId)
  return { ok: true }
}

export async function unlinkAddon(
  serviceId: string,
  addonId: string,
): Promise<ServiceActionResult> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "unauthorized" }

  const unlinked = await unlinkAddonFromService(db, serviceId, addonId)
  if (!unlinked.ok) return { ok: false, error: "Couldn’t unlink the add-on." }

  revalidateService(serviceId)
  return { ok: true }
}

/** Toggle whether two add-ons can be combined — GLOBAL (add-ons are shared).
    Resyncs every service that links both. */
export async function setAddonCompatibility(
  addonA: string,
  addonB: string,
  incompatible: boolean,
): Promise<ServiceActionResult> {
  const db = await requireOwner()
  if (!db) return { ok: false, error: "unauthorized" }
  if (addonA === addonB) return { ok: false, error: "Pick two add-ons." }

  // Pairs are stored once, in sorted order.
  const [a, b] = [addonA, addonB].sort()

  const saved = incompatible
    ? await addIncompatiblePair(db, a, b)
    : await removeIncompatiblePair(db, a, b)
  if (!saved.ok) return { ok: false, error: "Couldn’t save compatibility." }

  revalidatePath(routes.admin.services)
  return { ok: true }
}
