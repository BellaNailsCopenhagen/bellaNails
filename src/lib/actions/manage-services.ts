"use server"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"

import { requireOwner } from "@/lib/admin/require-owner"
import {
  createCalEventType,
  patchCalEventType,
} from "@/lib/cal-event-types"
import { computeSlotOptions } from "@/lib/services/booking-totals"
import {
  fetchIncompatiblePairs,
  flattenServiceAddons,
} from "@/lib/services/service-addons"
import type { Database } from "@/lib/supabase/types"

/**
 * Owner-managed catalog CRUD. Every action re-verifies the owner role (the UI
 * is never the boundary) and writes with the service-role client. Any change to
 * a service's duration, its add-ons, or their compatibility resyncs the Cal
 * event type's `lengthInMinutesOptions` so every bookable combination stays a
 * valid slot. A Cal sync failure is returned as `syncError` — the DB write
 * still stands; the studio retries the sync — rather than rolling back.
 */

export type ServiceActionResult =
  | { ok: true; syncError?: string }
  | { ok: false; error: string }

type Client = SupabaseClient<Database>

function revalidateService(id: string) {
  revalidatePath("/admin/services")
  revalidatePath(`/admin/services/${id}`)
}

/** kr (as typed) → integer cents. Rejects negatives / non-finite. */
function krToCents(kr: number): number | null {
  if (!Number.isFinite(kr) || kr < 0) return null
  return Math.round(kr * 100)
}

/**
 * Recompute the reachable slot set for a service and PATCH Cal. Runs after any
 * duration / add-on / incompatibility change. No-op (ok) when the service has
 * no Cal event yet.
 */
async function resyncSlotOptions(
  supabase: Client,
  serviceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: service } = await supabase
    .from("services")
    .select("cal_event_id, base_duration_mins")
    .eq("id", serviceId)
    .maybeSingle()
  if (!service?.cal_event_id) return { ok: true }

  // Add-ons linked to this service (many-to-many via service_addons).
  const { data: links } = await supabase
    .from("service_addons")
    .select("addons(id, extra_duration_mins, archived_at)")
    .eq("service_id", serviceId)
  type LinkedAddon = {
    id: string
    extra_duration_mins: number
    archived_at: string | null
  }
  const addons = flattenServiceAddons<LinkedAddon>(
    links as unknown as { addons: LinkedAddon | null }[],
    { dropArchived: true },
  )
  const addonIds = addons.map((a) => a.id)

  // A transient incompatibilities read shouldn't fail the save: degrade to no
  // pairs — an over-offer of slot lengths is harmless (the booking gate still
  // re-checks compatibility), whereas under-offering would break Cal.
  const pairs = await fetchIncompatiblePairs(supabase, addonIds).catch(() => [])

  const options = computeSlotOptions(
    service.base_duration_mins,
    (addons ?? []).map((a) => ({
      id: a.id,
      extraDurationMins: a.extra_duration_mins,
    })),
    pairs,
  )

  const result = await patchCalEventType(service.cal_event_id, {
    lengthInMinutes: service.base_duration_mins,
    lengthInMinutesOptions: options,
  })
  return result.ok ? { ok: true } : { ok: false, error: result.error }
}

/** Resync every service that links an add-on (after a global add-on change). */
async function resyncServicesLinkingAddon(
  supabase: Client,
  addonId: string,
): Promise<string | undefined> {
  const { data } = await supabase
    .from("service_addons")
    .select("service_id")
    .eq("addon_id", addonId)
  let syncError: string | undefined
  for (const id of new Set((data ?? []).map((r) => r.service_id))) {
    const result = await resyncSlotOptions(supabase, id)
    if (!result.ok) syncError = result.error
  }
  return syncError
}

/** Resync every service that links BOTH add-ons (after a compatibility change). */
async function resyncServicesLinkingBoth(
  supabase: Client,
  addonA: string,
  addonB: string,
): Promise<string | undefined> {
  const [{ data: la }, { data: lb }] = await Promise.all([
    supabase.from("service_addons").select("service_id").eq("addon_id", addonA),
    supabase.from("service_addons").select("service_id").eq("addon_id", addonB),
  ])
  const withB = new Set((lb ?? []).map((r) => r.service_id))
  const both = new Set(
    (la ?? []).map((r) => r.service_id).filter((id) => withB.has(id)),
  )
  let syncError: string | undefined
  for (const id of both) {
    const result = await resyncSlotOptions(supabase, id)
    if (!result.ok) syncError = result.error
  }
  return syncError
}

export type ServiceEditInput = {
  nameEn: string
  nameDa: string
  descriptionEn: string
  descriptionDa: string
  priceKr: number
  durationMins: number
}

export async function updateService(
  id: string,
  input: ServiceEditInput,
): Promise<ServiceActionResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const nameEn = input.nameEn.trim()
  if (nameEn.length < 2) return { ok: false, error: "Name is required." }
  const cents = krToCents(input.priceKr)
  if (cents === null) return { ok: false, error: "Price is invalid." }
  if (!Number.isInteger(input.durationMins) || input.durationMins <= 0) {
    return { ok: false, error: "Duration is invalid." }
  }

  const { data: current } = await supabase
    .from("services")
    .select("base_duration_mins")
    .eq("id", id)
    .maybeSingle()
  if (!current) return { ok: false, error: "Service not found." }
  const durationChanged = current.base_duration_mins !== input.durationMins

  const { error } = await supabase
    .from("services")
    .update({
      name_en: nameEn,
      name_dk: input.nameDa.trim() || nameEn,
      description_en: input.descriptionEn.trim() || null,
      description_dk: input.descriptionDa.trim() || null,
      base_price_cents: cents,
      base_duration_mins: input.durationMins,
    })
    .eq("id", id)
  if (error) return { ok: false, error: "Couldn’t save the service." }

  // Name/price/description don't touch Cal; duration does.
  let syncError: string | undefined
  if (durationChanged) {
    const sync = await resyncSlotOptions(supabase, id)
    if (!sync.ok) syncError = sync.error
  }

  revalidateService(id)
  return { ok: true, syncError }
}

export async function archiveService(
  id: string,
  archived: boolean,
): Promise<ServiceActionResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const { data: service } = await supabase
    .from("services")
    .select("cal_event_id")
    .eq("id", id)
    .maybeSingle()
  if (!service) return { ok: false, error: "Service not found." }

  const { error } = await supabase
    .from("services")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
  if (error) return { ok: false, error: "Couldn’t update the service." }

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

export type AddonEditInput = {
  nameEn: string
  nameDa: string
  priceKr: number
  durationMins: number
}

/** Create or edit a STANDALONE add-on (no service link — link separately).
    An edit resyncs every service that already links it (duration may change). */
export async function saveAddon(
  addonId: string | null,
  input: AddonEditInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const nameEn = input.nameEn.trim()
  if (nameEn.length < 2) return { ok: false, error: "Name is required." }
  const cents = krToCents(input.priceKr)
  if (cents === null) return { ok: false, error: "Price is invalid." }
  if (!Number.isInteger(input.durationMins) || input.durationMins < 0) {
    return { ok: false, error: "Duration is invalid." }
  }

  const fields = {
    name_en: nameEn,
    name_dk: input.nameDa.trim() || nameEn,
    extra_price_cents: cents,
    extra_duration_mins: input.durationMins,
  }

  if (addonId) {
    const { error } = await supabase
      .from("addons")
      .update(fields)
      .eq("id", addonId)
    if (error) return { ok: false, error: "Couldn’t save the add-on." }
    await resyncServicesLinkingAddon(supabase, addonId)
    revalidatePath("/admin/services")
    return { ok: true, id: addonId }
  }

  const { data, error } = await supabase
    .from("addons")
    .insert(fields)
    .select("id")
    .single()
  if (error || !data) return { ok: false, error: "Couldn’t save the add-on." }
  revalidatePath("/admin/services")
  return { ok: true, id: data.id }
}

/** Global archive/restore of an add-on; resyncs every linked service. */
export async function archiveAddon(
  addonId: string,
  archived: boolean,
): Promise<ServiceActionResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const { error } = await supabase
    .from("addons")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", addonId)
  if (error) return { ok: false, error: "Couldn’t update the add-on." }

  const syncError = await resyncServicesLinkingAddon(supabase, addonId)
  revalidatePath("/admin/services")
  return { ok: true, syncError }
}

/** Link an existing add-on to a service (many-to-many). */
export async function linkAddon(
  serviceId: string,
  addonId: string,
): Promise<ServiceActionResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const { error } = await supabase
    .from("service_addons")
    .upsert(
      { service_id: serviceId, addon_id: addonId },
      { onConflict: "service_id,addon_id" },
    )
  if (error) return { ok: false, error: "Couldn’t link the add-on." }

  const sync = await resyncSlotOptions(supabase, serviceId)
  revalidateService(serviceId)
  return { ok: true, syncError: sync.ok ? undefined : sync.error }
}

export async function unlinkAddon(
  serviceId: string,
  addonId: string,
): Promise<ServiceActionResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const { error } = await supabase
    .from("service_addons")
    .delete()
    .eq("service_id", serviceId)
    .eq("addon_id", addonId)
  if (error) return { ok: false, error: "Couldn’t unlink the add-on." }

  const sync = await resyncSlotOptions(supabase, serviceId)
  revalidateService(serviceId)
  return { ok: true, syncError: sync.ok ? undefined : sync.error }
}

/** Toggle whether two add-ons can be combined — GLOBAL now (add-ons are shared).
    Resyncs every service that links both. */
export async function setAddonCompatibility(
  addonA: string,
  addonB: string,
  incompatible: boolean,
): Promise<ServiceActionResult> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }
  if (addonA === addonB) return { ok: false, error: "Pick two add-ons." }

  const [a, b] = [addonA, addonB].sort()

  if (incompatible) {
    const { error } = await supabase
      .from("addon_incompatibilities")
      .upsert(
        { addon_id_a: a, addon_id_b: b },
        { onConflict: "addon_id_a,addon_id_b" },
      )
    if (error) return { ok: false, error: "Couldn’t save compatibility." }
  } else {
    const { error } = await supabase
      .from("addon_incompatibilities")
      .delete()
      .or(
        `and(addon_id_a.eq.${a},addon_id_b.eq.${b}),and(addon_id_a.eq.${b},addon_id_b.eq.${a})`,
      )
    if (error) return { ok: false, error: "Couldn’t save compatibility." }
  }

  const syncError = await resyncServicesLinkingBoth(supabase, a, b)
  revalidatePath("/admin/services")
  return { ok: true, syncError }
}

/** Create a service — its Cal event type is created first (the slug/id are
    NOT NULL), then the row. Fails without side effects if Cal rejects. */
export async function createService(input: {
  nameEn: string
  nameDa: string
  priceKr: number
  durationMins: number
  categoryId: string | null
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await requireOwner()
  if (!supabase) return { ok: false, error: "unauthorized" }

  const nameEn = input.nameEn.trim()
  if (nameEn.length < 2) return { ok: false, error: "Name is required." }
  const cents = krToCents(input.priceKr)
  if (cents === null) return { ok: false, error: "Price is invalid." }
  if (!Number.isInteger(input.durationMins) || input.durationMins <= 0) {
    return { ok: false, error: "Duration is invalid." }
  }

  const slug = `${nameEn
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}-${Date.now().toString(36)}`

  const cal = await createCalEventType({
    title: nameEn,
    slug,
    lengthInMinutes: input.durationMins,
    lengthInMinutesOptions: computeSlotOptions(input.durationMins, [], []),
  })
  if (!cal.ok) return { ok: false, error: `Cal sync failed: ${cal.error}` }

  const { data, error } = await supabase
    .from("services")
    .insert({
      name_en: nameEn,
      name_dk: input.nameDa.trim() || nameEn,
      base_price_cents: cents,
      base_duration_mins: input.durationMins,
      category_id: input.categoryId,
      cal_event_id: cal.data.id,
      cal_event_slug: cal.data.slug,
    })
    .select("id")
    .single()
  if (error || !data) return { ok: false, error: "Couldn’t create the service." }

  revalidatePath("/admin/services")
  return { ok: true, id: data.id }
}
