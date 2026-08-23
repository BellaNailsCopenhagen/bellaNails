import type { Metadata } from "next"

import { AdminNewBooking } from "@/app/admin/new/_components/admin-new-booking"
import type {
  CategoryGroup,
  ClientOption,
  ServiceOption,
} from "@/app/admin/new/_components/types"
import { getMaxAdvanceDays } from "@/modules/booking"
import { getAdminCatalog, type AdminService } from "@/modules/catalog"
import { getClientDirectory } from "@/modules/clients"
import { contactDisplayName } from "@/shared/contact"

export const metadata: Metadata = { title: "New booking" }

// Per-owner reads (session cookies) — dynamic, no static prerender attempt.
export const dynamic = "force-dynamic"

const toServiceOption = (s: AdminService): ServiceOption => ({
  id: s.id,
  name: s.name_en,
  priceCents: s.base_price_cents,
  durationMins: s.base_duration_mins,
})

/**
 * Admin "New booking" — the owner books for a client (new or existing) and
 * rebooks. Loads the roster + bookable catalog, then hands a client stepper the
 * lean shapes it needs. `?client=<id>` pre-selects a client (the rebook entry).
 */
export default async function AdminNewPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>
}) {
  const { client: preselectId } = await searchParams
  // eslint-disable-next-line react-hooks/purity -- request-time clock read
  const now = Date.now()
  const [{ clients: roster }, catalog, maxAdvanceDays] = await Promise.all([
    getClientDirectory(now),
    getAdminCatalog(),
    getMaxAdvanceDays(),
  ])

  const clients: ClientOption[] = roster.map((entry) => {
    const { contact } = entry
    return {
      id: entry.id,
      name: contactDisplayName(contact),
      search: [contact?.firstName, contact?.fullName, contact?.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    }
  })

  // Only active (non-archived) services are bookable; drop emptied categories.
  const active = (services: AdminService[]) =>
    services.filter((s) => !s.archived_at).map(toServiceOption)
  const categories: CategoryGroup[] = [
    ...catalog.categories.map((c) => ({
      id: c.id,
      name: c.name_en,
      services: active(c.services),
    })),
    { id: "uncategorized", name: "Other", services: active(catalog.uncategorized) },
  ].filter((group) => group.services.length > 0)

  const initialClient =
    (preselectId && clients.find((c) => c.id === preselectId)) || null

  return (
    <AdminNewBooking
      clients={clients}
      categories={categories}
      maxAdvanceDays={maxAdvanceDays}
      initialClient={initialClient}
    />
  )
}
