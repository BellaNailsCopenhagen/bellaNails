import "server-only"

import { listPendingBookingRequests } from "@/db/booking-requests"
import { fetchClientContacts } from "@/modules/clients/contacts"
import { requireOwner } from "@/modules/identity/require-owner"
import { localizedBookingNames, metaOf } from "@/shared/booking-policy"
import type { ClientContact } from "@/shared/contact"
import { ADMIN_LOCALE } from "@/config/admin"

/** A pending booking request, display-ready for the admin home section. */
export type RequestView = {
  id: string
  clientId: string
  kind: string
  serviceId: string | null
  addonIds: string[]
  serviceName: string
  addonNames: string[]
  startIso: string
  priceCents: number
  message: string | null
  createdAt: string
}

/** Pending requests + their client contacts for the admin home. Owner-gated;
    degrades to empty so a missing table never takes the queue down. */
export async function getPendingRequests(): Promise<{
  requests: RequestView[]
  contacts: Record<string, ClientContact>
}> {
  const db = await requireOwner()
  if (!db) {
    return { requests: [], contacts: {} }
  }

  const rows = await listPendingBookingRequests(db).catch(() => [])
  if (!rows.length) {
    return { requests: [], contacts: {} }
  }

  const contacts = await fetchClientContacts(rows.map((r) => r.client_id))
  const requests = rows.map((r) => {
    const meta = metaOf(r)
    const { serviceName, addonNames } = localizedBookingNames(
      meta,
      ADMIN_LOCALE,
    )

    return {
      id: r.id,
      clientId: r.client_id,
      kind: r.kind,
      serviceId: meta.serviceId ?? null,
      addonIds: meta.addonIds ?? [],
      serviceName,
      addonNames,
      startIso: r.start_time,
      priceCents: r.total_price_cents,
      message: r.message,
      createdAt: r.created_at,
    }
  })

  return { requests, contacts }
}
