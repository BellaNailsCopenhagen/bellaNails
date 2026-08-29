import type { Db } from "@/db/client"
import { listDataConsents } from "@/db/client-consents"
import { listMediaForClient } from "@/db/client-media"
import { presignedGet, storageConfigured } from "@/platform/storage/scaleway"

/**
 * Client media + release reads, shared by admin (service-role) and the client's
 * own My Space view (RLS own-read). Media use is now a booking-level RELEASE, so
 * status is per (booking, purpose) — the gallery groups media by booking and
 * shows that booking's release state. Private images never leak: RLS shows a row
 * only to the owner or the client it belongs to; public surfaces read the
 * published copies in `assets` instead.
 */

// Reused for data consents too — "none" is the UI default for an un-requested one.
export type ConsentStatus =
  | "none"
  | "requested"
  | "granted"
  | "declined"
  | "withdrawn"

export type ClientMediaItem = {
  id: string
  source: string
  kind: string
  url: string
  caption: string | null
  serviceId: string | null
  bookingId: string | null
  createdAt: string
}

type Client = Db

export async function getClientMedia(
  supabase: Client,
  clientId: string,
): Promise<ClientMediaItem[]> {
  const media = await listMediaForClient(supabase, clientId)

  // Private objects have no public URL — resolve a short-lived presigned GET for
  // display. Degrades to the stored locator when storage isn't configured.
  const configured = storageConfigured()
  return Promise.all(
    media.map(async (m) => {
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
        createdAt: m.created_at,
      }
    }),
  )
}

export type DataConsentItem = { purpose: string; status: ConsentStatus }

export async function getClientDataConsents(
  supabase: Client,
  clientId: string,
): Promise<DataConsentItem[]> {
  const data = await listDataConsents(supabase, clientId)
  return data.map((c) => ({
    purpose: c.purpose,
    status: c.status as ConsentStatus,
  }))
}
