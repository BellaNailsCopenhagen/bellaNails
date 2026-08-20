import "server-only"

import { listIncompatiblePairsAmong } from "@/db/addon-incompatibilities"
import type { Db } from "@/db/client"
import {
  listAddonsForService,
  listServiceIdsForAddon,
  listServiceIdsForAddonPair,
} from "@/db/service-addons"
import { getServiceCalWiring } from "@/db/services"
import { patchCalEventType } from "@/platform/cal/event-types"
import { computeSlotOptions } from "@/shared/booking-totals"

/**
 * Keeping Cal's bookable slot lengths in step with the catalog. Any change to a
 * service's duration, its add-ons, or their compatibility changes the set of
 * reachable totals, and Cal must offer exactly those or a valid combination
 * becomes unbookable.
 *
 * A sync failure is reported, never thrown: the DB write already stands and the
 * studio retries — rolling back a saved price because Cal blipped would be worse.
 */

export type SyncResult = { ok: true } | { ok: false; error: string }

/** Recompute the reachable slot set for one service and PATCH Cal. No-op (ok)
    when the service has no Cal event yet. */
export async function resyncSlotOptions(
  db: Db,
  serviceId: string,
): Promise<SyncResult> {
  const service = await getServiceCalWiring(db, serviceId)
  if (!service?.cal_event_id) return { ok: true }

  const addons = await listAddonsForService(db, serviceId)

  // A transient incompatibilities read shouldn't fail the save: degrade to no
  // pairs — an over-offer of slot lengths is harmless (the booking gate still
  // re-checks compatibility), whereas under-offering would break Cal.
  const pairs = await listIncompatiblePairsAmong(
    db,
    addons.map((a) => a.id),
  ).catch(() => [])

  const options = computeSlotOptions(
    service.base_duration_mins,
    addons.map((a) => ({ id: a.id, extraDurationMins: a.extra_duration_mins })),
    pairs,
  )

  const result = await patchCalEventType(service.cal_event_id, {
    lengthInMinutes: service.base_duration_mins,
    lengthInMinutesOptions: options,
  })
  return result.ok ? { ok: true } : { ok: false, error: result.error }
}

/** Resync every service that links an add-on (after a global add-on change). */
export async function resyncServicesLinkingAddon(
  db: Db,
  addonId: string,
): Promise<string | undefined> {
  const ids = await listServiceIdsForAddon(db, addonId)
  return resyncAll(db, ids)
}

/** Resync every service that links BOTH add-ons (after a compatibility change). */
export async function resyncServicesLinkingBoth(
  db: Db,
  addonA: string,
  addonB: string,
): Promise<string | undefined> {
  const ids = await listServiceIdsForAddonPair(db, addonA, addonB)
  return resyncAll(db, ids)
}

/** Resync a set, reporting the last failure (if any) rather than stopping. */
async function resyncAll(db: Db, serviceIds: string[]): Promise<string | undefined> {
  let syncError: string | undefined
  for (const id of serviceIds) {
    const result = await resyncSlotOptions(db, id)
    if (!result.ok) syncError = result.error
  }
  return syncError
}
