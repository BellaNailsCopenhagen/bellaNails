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
import { clientSearchText } from "@/shared/client-search"
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
 * lean shapes it needs. `?client=<id>` pre-selects a client; `?service=<id>` +
 * `?addons=<id,id>` are the one-tap "Book again" deep link from a booking card.
 */
export default async function AdminNewPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; service?: string; addons?: string }>
}) {
  const {
    client: preselectId,
    service: preselectServiceId,
    addons: preselectAddons,
  } = await searchParams
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
      search: clientSearchText({
        firstName: contact?.firstName,
        fullName: contact?.fullName,
        email: contact?.email,
        phone: contact?.phone,
      }),
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

  // Rebook prefill — resolve the service against the live, bookable list only, so
  // a since-archived service quietly falls back to the picker. Live add-ons are
  // intersected client-side once the flow loads them.
  const services = categories.flatMap((group) => group.services)
  const initialService =
    (preselectServiceId && services.find((s) => s.id === preselectServiceId)) ||
    null
  const initialAddonIds =
    initialService && preselectAddons
      ? preselectAddons.split(",").filter(Boolean)
      : []

  return (
    <AdminNewBooking
      clients={clients}
      categories={categories}
      maxAdvanceDays={maxAdvanceDays}
      initialClient={initialClient}
      initialService={initialService}
      initialAddonIds={initialAddonIds}
    />
  )
}
