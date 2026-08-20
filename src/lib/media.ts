import type { SupabaseClient } from "@supabase/supabase-js"

import { presignedGet, storageConfigured } from "@/lib/storage/scaleway"
import type { Database } from "@/lib/supabase/types"

/**
 * Client media + consent reads, shared by admin (service-role) and the client's
 * own /bookings view (RLS own-read) — so it lives in core, not lib/admin.
 * Private images never leak: RLS shows a row only to the owner or the client it
 * belongs to; public surfaces read the published copies in `assets` instead.
 */

export type ConsentStatus =
  | "none"
  | "requested"
  | "granted"
  | "declined"
  | "withdrawn"

export type MediaPurpose = "site" | "some"

export type ClientMediaItem = {
  id: string
  source: string
  kind: string
  url: string
  caption: string | null
  serviceId: string | null
  bookingId: string | null
  inGallery: boolean
  createdAt: string
  site: ConsentStatus
  some: ConsentStatus
}

type Client = SupabaseClient<Database>

export async function getClientMedia(
  supabase: Client,
  clientId: string,
): Promise<ClientMediaItem[]> {
  const { data: media, error } = await supabase
    .from("client_media")
    .select(
      "id, source, kind, url, storage_key, caption, service_id, booking_id, in_gallery, created_at",
    )
    .eq("client_id", clientId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)

  const ids = (media ?? []).map((m) => m.id)
  const consents = new Map<string, { site: ConsentStatus; some: ConsentStatus }>()
  if (ids.length) {
    const { data } = await supabase
      .from("media_consents")
      .select("client_media_id, purpose, status")
      .in("client_media_id", ids)
    for (const row of data ?? []) {
      const cur = consents.get(row.client_media_id) ?? {
        site: "none" as ConsentStatus,
        some: "none" as ConsentStatus,
      }
      if (row.purpose === "site") cur.site = row.status as ConsentStatus
      if (row.purpose === "some") cur.some = row.status as ConsentStatus
      consents.set(row.client_media_id, cur)
    }
  }

  // Private objects have no public URL — resolve a short-lived presigned GET for
  // display. Degrades to the stored locator when storage isn't configured.
  const configured = storageConfigured()
  return Promise.all(
    (media ?? []).map(async (m) => {
      let url = m.url
      if (configured && m.storage_key) {
        const signed = await presignedGet(m.storage_key)
        if (signed.ok) url = signed.data.url
      }
      return {
        id: m.id,
        source: m.source,
        kind: m.kind,
        url,
        caption: m.caption,
        serviceId: m.service_id,
        bookingId: m.booking_id,
        inGallery: m.in_gallery,
        createdAt: m.created_at,
        site: consents.get(m.id)?.site ?? "none",
        some: consents.get(m.id)?.some ?? "none",
      }
    }),
  )
}

export type DataConsentItem = { purpose: string; status: ConsentStatus }

export async function getClientDataConsents(
  supabase: Client,
  clientId: string,
): Promise<DataConsentItem[]> {
  const { data, error } = await supabase
    .from("client_consents")
    .select("purpose, status")
    .eq("client_id", clientId)
  if (error) throw new Error(error.message)
  return (data ?? []).map((c) => ({
    purpose: c.purpose,
    status: c.status as ConsentStatus,
  }))
}
